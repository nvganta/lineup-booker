import { languageModel } from "@/lib/agent/language-model";
import { generateText } from "ai";
import { z } from "zod";
import { agentModelChain } from "@/lib/agent/model";
import { getPersistentStore } from "@/lib/cache/persistent-store";
import { checkPlainAnswer } from "@/lib/compare/check-plain";
import { parsePlainAnswer, plainPrompt, type PlainResult } from "@/lib/compare/without-qloo";

export const maxDuration = 60;

const body = z.object({
  concept: z.string().min(1).max(200),
  address: z.string().min(1).max(200),
  regulars: z.string().max(200).default(""),
});

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function key(form: z.infer<typeof body>): string {
  const raw = JSON.stringify({ ...form, v: 1 });
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  return `without-qloo:v3:${(h >>> 0).toString(36)}:${raw.length}`;
}

/** The same model, asked with only the form fields, then checked: one Qloo call for the headliner. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const form = parsed.data;
  const store = getPersistentStore();
  const k = key(form);
  const hit = await store.get<PlainResult>(k);
  if (hit) return Response.json(hit);

  let result: { modelId: string; text: string } | null = null;
  for (const modelId of (await agentModelChain()).slice(0, 2)) {
    try {
      const { text } = await generateText({
        model: languageModel(modelId),
        maxRetries: 0,
        temperature: 0.3,
        abortSignal: AbortSignal.timeout(25_000),
        prompt: plainPrompt(form),
      });
      if (parsePlainAnswer(text)) {
        result = { modelId, text };
        break;
      }
      console.warn(`[without-qloo] ${modelId} gave no usable JSON`);
    } catch (err) {
      console.warn(`[without-qloo] ${modelId} failed: ${String(err instanceof Error ? err.message : err).slice(0, 120)}`);
    }
  }
  const answer = result ? parsePlainAnswer(result.text) : null;
  if (!result || !answer) return Response.json({ error: "no answer" }, { status: 502 });

  const out: PlainResult = { modelId: result.modelId, answer, ...(await checkPlainAnswer(answer, form)) };
  await store.set(k, out, TTL_MS);
  return Response.json(out);
}
