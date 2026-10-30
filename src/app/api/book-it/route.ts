import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { z } from "zod";
import { agentModelChain } from "@/lib/agent/model";
import {
  bookingPrompt,
  parseBookingEmail,
  templateBookingEmail,
  type BookingEmail,
  type BookingInput,
} from "@/lib/book/booking-email";
import { getPersistentStore } from "@/lib/cache/persistent-store";

export const maxDuration = 60;

const row = z.object({ label: z.string(), kind: z.enum(["drink", "food", "late", "diet"]), fans: z.number(), city: z.number() });
const body = z.object({
  headliner: z.string().min(1).max(80),
  opener: z.string().max(80).nullable(),
  openFor: z.string().max(200).nullable().optional(),
  venueLabel: z.string().min(1).max(200),
  address: z.string().min(1).max(200),
  cityLabel: z.string().max(80),
  neighborhoods: z.array(z.string().max(80)).max(5),
  styleTags: z.array(z.string().max(60)).max(4),
  rows: z.array(row).max(6).default([]),
});

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A drafted booking enquiry from what the run already found. No Qloo calls. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const input: BookingInput = parsed.data;
  const raw = JSON.stringify({ input, v: 1 });
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  const k = `book-it:v4:${(h >>> 0).toString(36)}:${raw.length}`;
  const store = getPersistentStore();
  const hit = await store.get<BookingEmail>(k);
  if (hit) return Response.json(hit);

  const gateway = createGatewayProvider({ apiKey: process.env.AI_GATEWAY_API_KEY });
  for (const modelId of (await agentModelChain()).slice(0, 2)) {
    try {
      const { text } = await generateText({
        model: gateway(modelId),
        maxRetries: 0,
        temperature: 0.3,
        abortSignal: AbortSignal.timeout(25_000),
        prompt: bookingPrompt(input),
      });
      const email = parseBookingEmail(text, input, (r) => console.warn(`[book-it] ${modelId} rejected: ${r}`));
      if (email) {
        await store.set(k, email, TTL_MS);
        return Response.json(email);
      }
    } catch (err) {
      console.warn(`[book-it] ${modelId} failed: ${String(err instanceof Error ? err.message : err).slice(0, 120)}`);
    }
  }
  return Response.json(templateBookingEmail(input));
}
