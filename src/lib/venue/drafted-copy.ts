import { languageModel } from "@/lib/agent/language-model";
import { generateText } from "ai";
import { agentModelChain } from "@/lib/agent/model";
import { getPersistentStore } from "@/lib/cache/persistent-store";
import type { TasteCountRow } from "./place-insights";

/** `basis` is the count row the idea rests on, or "nearby" for a tie-in. */
export type DraftIdea = { title: string; body: string; basis?: string };

export type DraftedCopy = {
  ideas: DraftIdea[];
  captions: string[];
  /** "agent" = written by the model and checked; "template" = filled from the counts. */
  source: "agent" | "template";
};

export type DraftInput = {
  headliner: string;
  opener: string | null;
  cityLabel: string;
  venueName: string;
  street: string;
  neighborhoods: string[];
  rows: TasteCountRow[];
  fanSample: number;
  citySample: number;
  nearEatDrink: string[];
  /** Acts whose origin really matches the venue city. */
  localActs: string[];
  styleTags: string[];
};

const COPY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Free models can be slow; the route allows 60 s in total. */
const MODEL_TIMEOUTS_MS = [32_000, 20_000];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function allowedNumbers(input: DraftInput): Set<string> {
  const nums = new Set<string>(["1.5"]);
  for (const r of input.rows) {
    nums.add(String(r.fans));
    nums.add(String(r.city));
  }
  nums.add(String(input.fanSample));
  nums.add(String(input.citySample));
  const texts = [
    input.street,
    input.venueName,
    input.headliner,
    input.opener ?? "",
    ...input.neighborhoods,
    ...input.nearEatDrink,
    ...input.styleTags,
  ];
  for (const t of texts) {
    for (const m of t.match(/\d+(?:\.\d+)?/g) ?? []) nums.add(m);
  }
  return nums;
}

const LOCAL_WORDS = /\b(local|locals'?|hometown|home-grown|homegrown|born and raised|native)\b|['’]s own\b/i;

/** Reasons a drafted line can't be shown; empty when it passes. */
export function draftProblems(text: string, input: DraftInput): string[] {
  const problems: string[] = [];
  if (/[$£€¥]/.test(text)) problems.push("price");
  if (/#\w/.test(text)) problems.push("hashtag");
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push("emoji");
  if (/sold[- ]out|guarantee|best in|#1|number one/i.test(text)) {
    problems.push("overclaim");
  }
  const allowed = allowedNumbers(input);
  const re = /(\d+(?:\.\d+)?)(\s*%)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = m[1]!;
    if (m[2]) {
      if (Number(n) > 50) problems.push(`percent ${n}`);
      continue;
    }
    if (!allowed.has(n)) problems.push(`number ${n}`);
  }
  const acts = [input.headliner, input.opener].filter(Boolean) as string[];
  const local = new Set(input.localActs.map((a) => a.toLowerCase()));
  if (local.size === 0) {
    if (LOCAL_WORDS.test(text)) problems.push("local claim");
  } else {
    for (const act of acts) {
      if (local.has(act.toLowerCase())) continue;
      const a = escapeRe(act);
      const near = new RegExp(
        `(local|hometown|homegrown|['’]s own)\\W+(?:\\w+\\W+){0,2}${a}|${a}\\W+(?:is|are)\\W+(?:a\\W+)?(local|from here|hometown)`,
        "i",
      );
      if (near.test(text)) problems.push(`local claim ${act}`);
    }
  }
  problems.push(...combinedRowProblems(text, input.rows));
  return problems;
}

function rowPattern(label: string): string {
  return label
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => `${escapeRe(w.replace(/s$/, ""))}s?`)
    .join("[\\s-]+");
}

/**
 * Each count row is a separate tag. Two rows written side by side
 * ("late-night burgers") claim the fans want both together, which the data
 * doesn't say.
 */
export function combinedRowProblems(text: string, rows: TasteCountRow[]): string[] {
  const out: string[] = [];
  const t = text.toLowerCase();
  for (const a of rows) {
    for (const b of rows) {
      if (a.label === b.label) continue;
      const re = new RegExp(
        `\\b${rowPattern(a.label)}[\\s-]+(?:[a-z']+[\\s-]+){0,1}${rowPattern(b.label)}\\b`,
        "i",
      );
      if (re.test(t)) out.push(`combined rows ${a.label} + ${b.label}`);
    }
  }
  return out;
}

function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}

export function parseDraft(
  raw: string,
  input: DraftInput,
  ideaCount: number,
  onReject?: (reason: string) => void,
): DraftedCopy | null {
  const reject = (reason: string) => {
    onReject?.(reason);
    return null;
  };
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return reject("no json");
  let json: unknown;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return reject("bad json");
  }
  const o = json as {
    ideas?: Array<{ title?: unknown; body?: unknown; basis?: unknown }>;
    captions?: unknown[];
  };
  const upRows = input.rows.filter((r) => r.fans > r.city);
  const basisOf = (b: unknown): string | undefined => {
    const v = clean(b, 60).toLowerCase();
    if (v === "nearby") return "nearby";
    return upRows.find((r) => r.label.toLowerCase() === v)?.label;
  };
  const ideas = (Array.isArray(o.ideas) ? o.ideas : [])
    .map((i) => ({ title: clean(i?.title, 80), body: clean(i?.body, 400), basis: basisOf(i?.basis) }))
    .filter((i) => i.title && i.body)
    .slice(0, ideaCount);
  const captions = (Array.isArray(o.captions) ? o.captions : [])
    .map((c) => clean(c, 400))
    .filter(Boolean)
    .slice(0, 2);
  if (ideas.some((i) => i.title.length > 40 || i.body.length > 120)) {
    return reject("idea too long");
  }
  if (ideas.some((i) => !i.basis)) return reject("idea without a basis");
  if (captions.some((c) => c.length > 150)) return reject("caption too long");
  if (captions.length === 2 && nearDuplicate(captions[0]!, captions[1]!)) {
    return reject("captions too alike");
  }
  // An idea must not be built on a count where the fans lean *less* than the city.
  const upCounts = new Set(input.rows.filter((r) => r.fans > r.city).map((r) => r.fans));
  const downCounts = new Set(
    input.rows.filter((r) => r.fans <= r.city).map((r) => r.fans).filter((n) => !upCounts.has(n)),
  );
  for (const idea of ideas) {
    for (const m of idea.body.matchAll(/\b(\d+) of (?:their|the fans)/gi)) {
      if (downCounts.has(Number(m[1]))) return reject("idea built on a lower count");
    }
  }
  if (ideas.length < Math.min(ideaCount, 2) && ideaCount > 0) {
    return reject("too few ideas");
  }
  if (captions.length < 2) return reject("missing captions");
  if (captions.every((c) => /\[date\]/i.test(c))) return reject("both captions repeat the date");
  const all = [
    ...ideas.flatMap((i) => [i.title, i.body]),
    ...captions,
  ];
  const problems = all.flatMap((t) => draftProblems(t, input));
  if (problems.length > 0) return reject(`checks: ${problems.slice(0, 4).join(", ")}`);
  return { ideas, captions, source: "agent" };
}

function words(s: string): Set<string> {
  return new Set(s.toLowerCase().match(/[a-z]{3,}/g) ?? []);
}

/** True when two captions share most of their words. */
export function nearDuplicate(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(1, Math.min(wa.size, wb.size)) > 0.6;
}

function promptFor(input: DraftInput, ideaCount: number): string {
  const line = (r: TasteCountRow) =>
    `- ${r.label}: ${r.fans} of the fans' top ${input.fanSample} places vs ${r.city} of the city's top ${input.citySample}`;
  const ups = input.rows.filter((r) => r.fans > r.city).map(line).join("\n");
  const downs = input.rows.filter((r) => r.fans <= r.city).map(line).join("\n");
  const rows = [
    "Where the fans' places lean MORE than the city's (build ideas only on these):",
    ups || "- none",
    "Less common among the fans' places (never build an idea on these):",
    downs || "- none",
  ].join("\n");
  return [
    `Venue: ${input.venueName}, ${input.street}, ${input.cityLabel}`,
    `Headliner: ${input.headliner}`,
    `Opener: ${input.opener ?? "none"}`,
    `Music styles: ${input.styleTags.join(", ") || "unknown"}`,
    `Neighbourhoods where the headliner's fans cluster: ${input.neighborhoods.join(", ") || "unknown"}`,
    `Acts whose hometown really is ${input.cityLabel}: ${input.localActs.join(", ") || "NONE"}`,
    "",
    "Counts of places tagged (fans' restaurants and bars vs the city's top restaurants and bars):",
    rows,
    "",
    `Fans' places within 1.5 km of the venue: ${input.nearEatDrink.join(", ") || "none"}`,
    "",
    "Write JSON only, no prose, with this shape:",
    `{"ideas":[{"basis":"...","title":"...","body":"..."}],"captions":["...","..."]}`,
    "",
    ideaCount === 0
      ? "ideas: return an empty array."
      : `ideas: exactly ${ideaCount} night-of food or drink deal ideas for the owner. basis is the exact label of the MORE row the idea rests on${input.nearEatDrink.length >= 2 ? ', or "nearby" for a tie-in' : ""}. title is at most five plain words. body is one short sentence, under 90 characters, saying what to do on the night. Do not repeat the counts; they are shown next to the idea.${input.nearEatDrink.length >= 2 ? ' Make the last idea a tie-in with up to two of the nearby places, basis "nearby".' : ""}`,
    "captions: two ready-to-post social captions announcing the night, each under 120 characters. Use [date] and [time] as placeholders. Make them clearly different: the first names the acts with [date] and [time]; the second has no date or time and says why to come (the food or drink the fans like).",
    "",
    "Rules:",
    "- Use only the facts above. Do not invent prices, statistics, dates, awards or history.",
    "- No currency amounts. A simple offer like 10% off is fine.",
    "- Only name places from the 1.5 km list.",
    `- Never call an act local, hometown or "${input.cityLabel}'s own" unless it is listed as a hometown act above.`,
    "- No hashtags, no emoji, no exclamation marks. Plain, warm, specific.",
    "- Each count row is a separate tag. Never merge two rows into one claim, e.g. do not write \"late-night burgers\" from separate Late night and Burgers rows.",
  ].join("\n");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function streetName(street: string): string {
  return street.replace(/^\d+[a-z]?\s+/i, "").trim();
}

/** Deterministic copy straight from the counts, used when no model answer passes. */
export function templateDraft(input: DraftInput, ideaCount: number): DraftedCopy {
  const ideas: DraftIdea[] = [];
  const ups = input.rows.filter((r) => r.fans > r.city && r.kind !== "diet");
  for (const r of ups.slice(0, Math.max(0, ideaCount - 1))) {
    if (r.kind === "late") {
      ideas.push({
        basis: r.label,
        title: "Keep the kitchen open late",
        body: "Keep plates going after the set.",
      });
    } else if (r.kind === "drink") {
      ideas.push({
        basis: r.label,
        title: `${capitalize(r.label.toLowerCase())} on special`,
        body: "Put one on special for the night.",
      });
    } else {
      ideas.push({
        basis: r.label,
        title: `A ${r.label.toLowerCase()} plate`,
        body: "Add one to the menu for the show.",
      });
    }
  }
  if (ideas.length < ideaCount && input.nearEatDrink.length >= 2) {
    const names = input.nearEatDrink.slice(0, 2);
    ideas.push({
      basis: "nearby",
      title: "Team up nearby",
      body: `10% off a first drink with a same-day receipt from ${joinNames(names)}.`,
    });
  }
  const where = input.street || input.venueName;
  const opens = input.opener ? ` ${input.opener} opens.` : "";
  const style = input.styleTags[0];
  const onStreet = streetName(input.street);
  const captions = [
    `${input.headliner} at ${where}.${opens} [date], doors [time].`,
    `${style ? `${capitalize(style)} on ${onStreet || input.cityLabel}` : "One night only"}. Come early for a seat.`,
  ];
  return { ideas: ideas.slice(0, ideaCount), captions, source: "template" };
}

function cacheKey(input: DraftInput, ideaCount: number): string {
  const raw = JSON.stringify({ input, ideaCount, v: 6 });
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  return `venue-copy:${(h >>> 0).toString(36)}:${raw.length}`;
}

export async function draftVenueCopy(
  input: DraftInput,
  ideaCount: number,
): Promise<DraftedCopy> {
  const store = getPersistentStore();
  const key = cacheKey(input, ideaCount);
  const hit = await store.get<DraftedCopy>(key);
  if (hit) return hit;

  const modelIds = (await agentModelChain()).slice(0, 2);
  const prompt = promptFor(input, ideaCount);
  for (const [i, modelId] of modelIds.entries()) {
    try {
      const { text } = await generateText({
        model: languageModel(modelId),
        maxRetries: 0,
        temperature: 0.3,
        abortSignal: AbortSignal.timeout(MODEL_TIMEOUTS_MS[i] ?? 20_000),
        system:
          "You draft short promo copy for a small venue owner. You only use the facts you are given and answer with JSON only.",
        prompt,
      });
      const parsed = parseDraft(text, input, ideaCount, (reason) =>
        console.warn(
          `[venue-copy] ${modelId} rejected: ${reason} (${text.length} chars: ${JSON.stringify(text.slice(0, 160))})`,
        ),
      );
      if (parsed) {
        await store.set(key, parsed, COPY_TTL_MS);
        return parsed;
      }
    } catch (err) {
      // try the next model, then fall back to the counts
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : "error";
      console.warn(`[venue-copy] ${modelId} failed: ${msg.slice(0, 160)}`);
    }
  }
  return templateDraft(input, ideaCount);
}
