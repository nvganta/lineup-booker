import type { GeocodeResult } from "@/lib/geocode/nominatim";
import { artistOriginMatchesVenue, cityLabelsEquivalent, type VenuePin } from "@/lib/lineup/geography";

export type PlainForm = { concept: string; address: string; regulars: string };

export type PlainAct = { name: string; why: string; local: boolean };

export type PlainAnswer = {
  headliner: PlainAct;
  opener: PlainAct | null;
  neighbourhoods: string[];
};

/** A check we could make with real data. `ok` false means the claim is wrong. */
export type Mark = { ok: boolean; text: string };

export type PlainResult = {
  modelId: string;
  answer: PlainAnswer;
  marks: {
    headliner: Mark[];
    opener: Mark[];
    neighbourhoods: Array<Mark | null>;
  };
};

/** Only what the owner typed. No Qloo data goes in. */
export function plainPrompt(form: PlainForm): string {
  return [
    "A venue owner wants to book a live music night.",
    `Venue: ${form.concept}`,
    `Address: ${form.address}`,
    form.regulars ? `What regulars love: ${form.regulars}` : "",
    "",
    "Suggest a headliner and a local opener who would realistically play this room, and the five neighbourhoods of this city where the headliner's fans live, to put posters up in.",
    'Keep each "why" to one short sentence, under 20 words.',
    'Answer with JSON only: {"headliner":{"name":"","why":""},"opener":{"name":"","local":true,"why":""},"neighbourhoods":["","","","",""]}',
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Cut at a word, never mid-word. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, s.lastIndexOf(" ", max)).replace(/[,;:\s]+$/, "") + "…";
}

function act(v: unknown): PlainAct | null {
  const o = (v ?? {}) as { name?: unknown; why?: unknown; local?: unknown };
  const name = str(o.name, 80);
  if (!name) return null;
  return { name, why: clip(str(o.why, 400), 160), local: o.local === true };
}

export function parsePlainAnswer(raw: string): PlainAnswer | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let o: { headliner?: unknown; opener?: unknown; neighbourhoods?: unknown; neighborhoods?: unknown };
  try {
    o = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const headliner = act(o.headliner);
  if (!headliner) return null;
  const list = Array.isArray(o.neighbourhoods) ? o.neighbourhoods : Array.isArray(o.neighborhoods) ? o.neighborhoods : [];
  const neighbourhoods = [...new Set(list.map((n) => str(n, 60)).filter(Boolean))].slice(0, 5);
  return { headliner, opener: act(o.opener), neighbourhoods };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Did the plain answer say this act is from the venue's city? */
export function claimsLocal(a: PlainAct, city: string): boolean {
  if (a.local) return true;
  const c = escapeRe(city);
  return new RegExp(`\\b(local|hometown|${c}[- ]based|from ${c}|${c}['’]s own|${c}(?: [a-z-]+){0,3} (?:band|act|artist|singer|duo|trio|group|collective|songwriter|outfit|musician)s?)\\b`, "i").test(a.why);
}

/** Origin from Wikipedia or MusicBrainz, checked only when the answer claims the act is local. */
export function markOrigin(a: PlainAct, origin: string | undefined, pin: VenuePin): Mark[] {
  if (!origin || !claimsLocal(a, pin.displayCity || pin.city)) return [];
  // "United Kingdom" alone can't say whether an act is from London: leave it unmarked.
  if (!origin.includes(",")) return [];
  return artistOriginMatchesVenue(origin, pin)
    ? [{ ok: true, text: `From ${origin}` }]
    : [{ ok: false, text: `From ${origin}` }];
}

/** A neighbourhood is marked only when the map lookup says it is a street or outside the city. */
export function markNeighbourhood(hit: GeocodeResult | null, pin: VenuePin): Mark | null {
  if (!hit) return null;
  const cls = (hit.placeClass ?? "").toLowerCase();
  if (cls === "highway") return { ok: false, text: "a street" };
  const city = hit.cityForHeatmap?.trim();
  const isArea = cls === "place" || cls === "boundary" || cls === "landuse";
  const sameCity = [pin.city, pin.displayCity, pin.borough, pin.county]
    .filter((c): c is string => Boolean(c))
    .some((c) => city && cityLabelsEquivalent(city, c));
  if (isArea && city && !sameCity) {
    return { ok: false, text: `in ${city}` };
  }
  return null;
}
