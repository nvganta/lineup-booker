import type { ToolExecutionOptions, ToolSet } from "ai";
import type { LineupRequest } from "@/lib/lineup/schemas";
import type { AgentSessionState } from "./types";

const SETUP_OPTIONS = { toolCallId: "setup", messages: [] } as unknown as ToolExecutionOptions<never>;

/** The owner's own list items: "indie folk, soul" is two phrases, "folk and vinyl nights" one. */
export function regularsPhrases(regularsLove: string): string[] {
  const phrases = regularsLove
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 6);
  return phrases.length ? phrases : [regularsLove.trim() || "live music"];
}

/**
 * Locate, size and tag the room before the model's first step. Every run
 * needs all three and there is nothing to decide, but free models called
 * them one per step and spent half the six-step budget before reaching a
 * headliner. Run here, in parallel, they cost no model round trips; the
 * model still reads their verdicts and decides whether to refine.
 */
export async function runScoutSetup(tools: ToolSet, input: LineupRequest): Promise<void> {
  await Promise.allSettled([
    tools.locate_venue!.execute!(
      { address: input.location, why: "Pin the room so every lookup is local." },
      SETUP_OPTIONS,
    ),
    tools.room_size_band!.execute!(
      { concept: input.concept, why: "Size the acts to the room's capacity." },
      SETUP_OPTIONS,
    ),
    tools.find_music_tags!.execute!(
      {
        phrases: regularsPhrases(input.regularsLove),
        concept: input.concept,
        why: "Turn what the regulars love into taste tags.",
      },
      SETUP_OPTIONS,
    ),
  ]);
}

/**
 * What the scout already knows, for the model's prompt. Rebuilt for each
 * model attempt, so a fallback model picks up where a stalled one stopped.
 */
export function scoutBrief(session: AgentSessionState): string {
  const lines: string[] = [];
  const pin = session.pin;
  lines.push(
    pin
      ? `- Venue pinned in ${pin.displayCity || pin.city}${pin.suburb ? ` (${pin.suburb})` : ""}.`
      : "- Venue NOT pinned yet: call locate_venue first.",
  );
  if (session.band) {
    const b = session.band;
    lines.push(
      `- Room band set (headliner popularity ${b.headlinerMin ?? 0}–${b.headlinerMax ?? 1}, widen level ${session.widenLevel}).`,
    );
  } else {
    lines.push("- Room band NOT set yet: call room_size_band.");
  }
  if (session.tagIds.length) {
    const tags = session.tagIds.map((id, i) => `${id} (${session.tagLabels[i] ?? "tag"})`).join(", ");
    const coverage = session.tagIds.length > 1 ? "several tags" : "one tag";
    lines.push(`- Music tags found, ${coverage}: ${tags}. Use these ids.`);
  } else {
    lines.push("- No music tags yet: call find_music_tags.");
  }
  if (session.headlinerEntity) {
    lines.push(`- Headliner chosen: ${session.headlinerEntity.name} (${session.headlinerEntity.id}).`);
  }
  if (session.extrasScouted) {
    lines.push("- Opener, neighbourhoods and crowd are scouted: call compose_pitch.");
  }
  return `What the scout already knows (don't repeat calls whose result is listed here):\n${lines.join("\n")}`;
}
