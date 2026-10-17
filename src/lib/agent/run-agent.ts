import { createGatewayProvider } from "@ai-sdk/gateway";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { lineupRequestSchema } from "@/lib/lineup/schemas";
import {
  agentFallbackModelIds,
  agentModelId,
  AGENT_TEMPERATURE,
} from "./model";
import { AgentBudget, AgentBudgetError } from "./budget";
import {
  createEmptySession,
  getAgentRuntime,
  runOutsideAgentRuntime,
  runWithAgentRuntime,
  type AgentRuntime,
} from "./runtime";
import { createStreamWriter } from "./stream-writer";
import { buildAgentTools } from "./tools";
import { AGENT_SYSTEM_PROMPT, agentUserPrompt } from "./system-prompt";
import { runQuickMode } from "./quick-mode";
import { salvagePitch } from "./salvage-pitch";
import { applyArtistBackgroundsToPitch } from "./research/apply-pitch";
import {
  flushArtistResearch,
  researchSourceFootnotes,
} from "./research/scheduler";
import { RESEARCH_TOTAL_MS } from "./research/types";
import { validatePitchPayload } from "./pitch-validator";
import {
  isGatewayRateLimitError,
  isModelUnavailableError,
} from "./model-fallback";

export const maxDuration = 60;

function hasGateway(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL);
}

async function finishAgentRun(
  input: LineupRequest,
  runtime: AgentRuntime,
  sw: ReturnType<typeof createStreamWriter>,
): Promise<void> {
  if (runtime.session.pitch) {
    sw.writeSummary({
      elapsedSec: runtime.budget.elapsedSec(),
      qlooLookups: runtime.budget.qlooCalls,
      retries: runtime.retries,
      quickMode: false,
    });
    return;
  }

  await flushArtistResearch(runtime.session, RESEARCH_TOTAL_MS);
  let salvaged = salvagePitch(runtime.session, input);
  if (salvaged) {
    const backgrounds = runtime.session.artistBackgrounds ?? {};
    salvaged = applyArtistBackgroundsToPitch(salvaged, backgrounds);
    salvaged = {
      ...salvaged,
      evidenceFootnotes: {
        ...salvaged.evidenceFootnotes,
        ...researchSourceFootnotes(backgrounds),
      },
    };
    runtime.session.pitch = salvaged;
    sw.writePitch(salvaged);
    sw.writeStep({
      id: crypto.randomUUID(),
      kind: "pitch",
      status: "done",
      label: "Wrapped up with the scout's picks.",
      // Only blame the clock when the clock ran out; a busy or failed model
      // ends here too, often well inside the budget.
      why: runtime.budget.pastSoftLimit()
        ? "Out of time for the write-up, so this pitch uses plain copy."
        : "The write-up didn't come back in time, so this pitch uses plain copy.",
    });
    sw.writeSummary({
      elapsedSec: runtime.budget.elapsedSec(),
      qlooLookups: runtime.budget.qlooCalls,
      retries: runtime.retries,
      quickMode: false,
    });
    return;
  }

  console.error("[agent] run ended without validated pitch", {
    headliner: runtime.session.headlinerEntity?.id,
    neighborhoods: runtime.session.neighborhoods.length,
    qlooCalls: runtime.budget.qlooCalls,
  });

  runtime.retries += 1;
  sw.writeStep({
    id: crypto.randomUUID(),
    kind: "retry",
    status: "weak",
    label: "Switching to Quick mode.",
    why: "The scout couldn't finish, so this is the standard lineup.",
  });

  await runOutsideAgentRuntime(async () => {
    runtime.session.pitch = await runQuickMode(
      input,
      sw,
      runtime.budget.startedAt,
      runtime.budget.qlooCalls,
      runtime.session,
    );
  });
}

function streamAgentText(
  modelId: string,
  input: LineupRequest,
  runtime: AgentRuntime,
  onStreamError: (error: unknown) => void,
) {
  const gateway = createGatewayProvider({
    apiKey: process.env.AI_GATEWAY_API_KEY,
  });
  return streamText({
    model: gateway(modelId),
    maxRetries: 0,
    // The real gateway error (rate limit, unavailable) only arrives here;
    // `await result.text` just rejects with NoOutputGeneratedError.
    onError: ({ error }) => onStreamError(error),
    temperature: AGENT_TEMPERATURE,
    system: AGENT_SYSTEM_PROMPT,
    prompt: agentUserPrompt(input),
    tools: buildAgentTools(),
    stopWhen: [
      stepCountIs(6),
      () => Boolean(getAgentRuntime()?.session.pitch),
    ],
    // One shared deadline across model rotations, so a fallback model can't
    // restart the 35s clock and push Quick mode past the 60s function limit.
    abortSignal: AbortSignal.timeout(
      Math.max(
        1_000,
        runtime.budget.hardLimitMs - (Date.now() - runtime.budget.startedAt),
      ),
    ),
    // Tools are gated by what the scout has found, not by step number, so the
    // model can still refine on a weak verdict (adjacent_genres, widen) inside
    // the 6-call budget: setup → [refine] → headliner → scout → compose.
    prepareStep: async () => {
      const s = runtime.session;
      const finish = {
        activeTools: ["compose_pitch" as const],
        system:
          AGENT_SYSTEM_PROMPT +
          "\n\nCall compose_pitch now with the evidence you already have.",
      };
      if (s.headlinerEntity && runtime.budget.pastSoftLimit()) return finish;
      if (!s.pin || !s.band || s.knownTagIds.size === 0) {
        return {
          activeTools: [
            "locate_venue" as const,
            "room_size_band" as const,
            "find_music_tags" as const,
          ],
          system:
            AGENT_SYSTEM_PROMPT +
            "\n\nBatch locate_venue, room_size_band and find_music_tags in this one step.",
        };
      }
      if (!s.headlinerEntity) {
        return {
          activeTools: [
            "discover_headliners" as const,
            "adjacent_genres" as const,
            "room_size_band" as const,
          ],
          system:
            AGENT_SYSTEM_PROMPT +
            "\n\nRead the verdicts so far. If one was weak (thin tag coverage, too few candidates), refine once with adjacent_genres or room_size_band widen; otherwise call discover_headliners.",
        };
      }
      if (!s.extrasScouted) {
        return {
          activeTools: [
            "scout_after_headliner" as const,
            "room_size_band" as const,
            "discover_headliners" as const,
          ],
          system:
            AGENT_SYSTEM_PROMPT +
            "\n\nThe headliner is set. If its verdict was weak you may widen once and rediscover; otherwise call scout_after_headliner.",
        };
      }
      return finish;
    },
  });
}

async function runLlmAgent(
  input: LineupRequest,
  runtime: AgentRuntime,
  mergeStream: (stream: ReadableStream<unknown>) => void,
): Promise<void> {
  const modelIds = [
    agentModelId(),
    ...agentFallbackModelIds().filter((m) => m !== agentModelId()),
  ];
  let lastError: unknown;
  for (let i = 0; i < modelIds.length; i++) {
    const modelId = modelIds[i]!;
    let streamError: unknown;
    try {
      const result = streamAgentText(modelId, input, runtime, (e) => {
        streamError = e;
      });
      // Drop the stream's own error part: a failed model is handled here
      // (rotate or fall back), not shown to the owner as a broken run.
      mergeStream(
        result.toUIMessageStream().pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              if ((chunk as { type?: string }).type !== "error") {
                controller.enqueue(chunk);
              }
            },
          }),
        ),
      );
      await result.text;
      return;
    } catch (err) {
      lastError = streamError ?? err;
      if (
        isGatewayRateLimitError(streamError) ||
        isGatewayRateLimitError(err)
      ) {
        console.error("[agent] gateway rate limit — salvaging without rotation");
        return;
      }
      if (
        i < modelIds.length - 1 &&
        (isModelUnavailableError(streamError) || isModelUnavailableError(err))
      ) {
        console.error("[agent] model unavailable, rotating", modelId);
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("Agent models exhausted");
}

export function createAgentResponse(body: unknown): Response {
  const parsed = lineupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const sw = createStreamWriter({
        write: (part) => writer.write(part as never),
      });
      const budget = new AgentBudget();
      const runtime: AgentRuntime = {
        budget,
        session: createEmptySession(),
        writer: sw,
        retries: 0,
        lineupRequest: input,
      };

      sw.writeStep({
        id: crypto.randomUUID(),
        kind: "plan",
        status: "done",
        label: "Scouting one night for this room.",
        why: "Plan locked before tool calls.",
      });

      try {
        await runWithAgentRuntime(runtime, async () => {
          if (!hasGateway()) {
            throw new Error("AI Gateway not configured");
          }
          try {
            await runLlmAgent(input, runtime, (s) =>
              writer.merge(s as never),
            );
          } catch (err) {
            if (err instanceof AgentBudgetError) {
              console.error("[agent] budget stop", err.kind, err.message);
            } else {
              console.error("[agent] llm run failed", err);
            }
          }
          await finishAgentRun(input, runtime, sw);
        });
        if (!runtime.session.pitch) {
          await finishAgentRun(input, runtime, sw);
        }
      } catch (err) {
        console.error("[agent] fatal", err);
        await runOutsideAgentRuntime(async () => {
          runtime.session.pitch = await runQuickMode(
            input,
            sw,
            budget.startedAt,
            budget.qlooCalls,
            runtime.session,
          );
        });
      }

      if (!runtime.session.pitch) {
        throw new Error("Agent finished without pitch");
      }

      const pin = runtime.session.pin;
      const validation = validatePitchPayload(runtime.session.pitch, [
        pin?.city,
        pin?.suburb,
        pin?.state,
        ...runtime.session.tagLabels,
        ...runtime.session.tagLabels.flatMap((l) => l.split(/\s*-\s*/)),
      ]);
      if (!validation.ok) {
        console.error("[agent] final pitch invalid", validation);
        throw new Error("Agent pitch failed validation");
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
