import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { z } from "zod";
import { agentModelChain } from "@/lib/agent/model";
import { getPersistentStore } from "@/lib/cache/persistent-store";
import {
  markNeighbourhood,
  markOrigin,
  parsePlainAnswer,
  plainPrompt,
  type PlainResult,
} from "@/lib/compare/without-qloo";
import {
  displayCityLabelFromGeocode,
  geocodeLocation,
  geocodeWithRetries,
} from "@/lib/geocode/nominatim";
import { lookupArtistOrigin } from "@/lib/lineup/artist-origin-lookup";
import type { VenuePin } from "@/lib/lineup/geography";

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
  return `without-qloo:v2:${(h >>> 0).toString(36)}:${raw.length}`;
}

/** The same free model, asked with only the form fields. No Qloo calls. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const form = parsed.data;
  const store = getPersistentStore();
  const k = key(form);
  const hit = await store.get<PlainResult>(k);
  if (hit) return Response.json(hit);

  const gateway = createGatewayProvider({ apiKey: process.env.AI_GATEWAY_API_KEY });
  let result: { modelId: string; text: string } | null = null;
  for (const modelId of (await agentModelChain()).slice(0, 2)) {
    try {
      const { text } = await generateText({
        model: gateway(modelId),
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

  const geo = await geocodeWithRetries(form.address).catch(() => null);
  const marks: PlainResult["marks"] = {
    headliner: [],
    opener: [],
    neighbourhoods: answer.neighbourhoods.map(() => null),
  };
  if (geo) {
    const pin: VenuePin = {
      lat: geo.lat,
      lon: geo.lon,
      city: geo.cityForHeatmap,
      displayCity: displayCityLabelFromGeocode(geo),
      state: geo.state,
      country: geo.country,
      county: geo.county,
      stateDistrict: geo.stateDistrict,
      borough: geo.address?.borough ?? geo.address?.city_district,
    };
    const [hOrigin, oOrigin] = await Promise.all([
      lookupArtistOrigin(answer.headliner.name, undefined, 2500),
      answer.opener ? lookupArtistOrigin(answer.opener.name, undefined, 2500) : Promise.resolve(undefined),
    ]);
    marks.headliner = markOrigin(answer.headliner, hOrigin, pin);
    if (answer.opener) marks.opener = markOrigin(answer.opener, oOrigin, pin);
    const city = pin.displayCity || pin.city;
    for (const [i, n] of answer.neighbourhoods.entries()) {
      const g = await geocodeLocation(`${n}, ${city}`).catch(() => null);
      marks.neighbourhoods[i] = markNeighbourhood(g, pin);
    }
  }
  const out: PlainResult = { modelId: result.modelId, answer, marks };
  await store.set(k, out, TTL_MS);
  return Response.json(out);
}
