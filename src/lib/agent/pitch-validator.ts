import type { PitchPayload } from "./types";

const FORBIDDEN_CLAIMS =
  /\b(sold\s*out|sell\s*out|sell-out|guarantee|guaranteed|forecast|predict(?:ion|s)?|will\s+draw|ticket\s+forecast)\b/i;

/** Owner-facing copy must not leak tool names, scores or tag ids. */
const INTERNAL_JARGON =
  /\b[a-z]+_[a-z_]+\b|\b\d+\.\d+\b|\bpopularity\b|\burn:|\btag ids?\b/i;

/** Subjective artist copy the model must not invent. */
const SUBJECTIVE_CLAIMS =
  /\b(emotive|introspective|songwriting|soulful|haunting|ethereal|captivating|lyrical|powerful vocals|unique sound|raw energy|genre[- ]bending|thought[- ]provoking)\b/i;

export type PitchValidationResult =
  | { ok: true }
  | { ok: false; reason: string; unknownNames: string[] };

export function collectAllowedNames(pitch: PitchPayload): Set<string> {
  const allowed = new Set<string>();
  for (const n of [
    pitch.headliner.name,
    pitch.opener?.name,
    ...pitch.alternates.map((a) => a.name),
    ...pitch.neighborhoods.map((nb) => nb.name),
    pitch.venueLabel,
  ]) {
    if (n) allowed.add(n.trim().toLowerCase());
  }
  for (const part of pitch.address.split(/[,/]/)) {
    const p = part.trim().toLowerCase();
    if (p.length > 2) allowed.add(p);
    // "Shoreditch High St" in the address allows "Shoreditch High Street".
    const expanded = p
      .replace(/\bst\b\.?/g, "street")
      .replace(/\bave\b\.?/g, "avenue")
      .replace(/\bblvd\b\.?/g, "boulevard")
      .replace(/\brd\b\.?/g, "road")
      .replace(/^\d+[a-z]?\s+/, "");
    if (expanded.length > 2) allowed.add(expanded);
  }

  for (const bg of [
    pitch.headliner.background,
    pitch.opener?.background,
  ]) {
    if (!bg) continue;
    allowed.add(bg.line.trim().toLowerCase());
    const knownFor = bg.line.match(/known for (.+)$/i);
    if (knownFor?.[1]) {
      allowed.add(knownFor[1].trim().toLowerCase());
      for (const w of knownFor[1].split(/\s+/)) {
        const key = w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
        if (key.length > 2) allowed.add(key);
      }
    }
    for (const chunk of bg.line.split(/[·,]/)) {
      const words = chunk.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/);
      for (const w of words) {
        const key = w.trim().toLowerCase();
        if (key.length > 2) allowed.add(key);
        const dehyphen = key.replace(/-/g, " ");
        for (const part of dehyphen.split(/\s+/)) {
          if (part.length > 2) allowed.add(part);
        }
      }
    }
    if (bg.sourceName) allowed.add(bg.sourceName.toLowerCase());
  }

  return allowed;
}

/** @internal tests — allowlist from raw research records before pitch cards exist */
export function extendAllowedFromResearchBackgrounds(
  allowed: Set<string>,
  backgrounds: Array<{
    origin?: string;
    activeSince?: string;
    knownFor?: string;
    notableReleases?: string[];
  }>,
): void {
  for (const bg of backgrounds) {
    if (bg.origin) {
      for (const part of bg.origin.split(/[,/]/)) {
        const p = part.trim().toLowerCase();
        if (p.length > 2) allowed.add(p);
      }
      allowed.add(bg.origin.trim().toLowerCase());
      const city = bg.origin.split(",")[0]?.trim().toLowerCase();
      if (city && city.length > 2) allowed.add(`${city}-born`);
    }
    if (bg.activeSince) allowed.add(bg.activeSince.trim());
    if (bg.knownFor) {
      for (const w of bg.knownFor.split(/\s+/)) {
        const key = w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
        if (key.length > 2) allowed.add(key);
      }
    }
    for (const rel of bg.notableReleases ?? []) {
      allowed.add(rel.trim().toLowerCase());
      for (const w of rel.split(/\s+/)) {
        const key = w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
        if (key.length > 2) allowed.add(key);
      }
    }
  }
}

/** Proper-name-like tokens: Title Case, ALL CAPS, or accented (e.g. "Fjöra", "DJ Fixture"). */
const NAME_TOKEN =
  /\b(?:[A-Z]{2,}|[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)*)\b/gu;

const COMMON_NON_NAMES = new Set([
  "live",
  "main",
  "street",
  "one",
  "night",
  "crowd",
  "local",
  "mixed",
  "nearby",
  "your",
  "the",
  "this",
  "room",
  "indie",
  "folk",
  "quick",
  "mode",
]);

function sentenceChunks(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripSentenceInitialCapitalized(sentence: string): string {
  return sentence.replace(
    /^(\s*)([A-Z][\p{L}'’-]+)(\s+)/u,
    (_, lead, _word, tail) => `${lead}${tail}`,
  );
}

export function findUnknownProperNames(
  text: string,
  allowed: Set<string>,
  addressAllowlist: string,
): string[] {
  const addressLower = addressAllowlist.toLowerCase();
  const unknown: string[] = [];

  for (const sentence of sentenceChunks(text)) {
    const scan = stripSentenceInitialCapitalized(sentence);
    const tokens = scan.match(NAME_TOKEN) ?? [];
    for (const token of tokens) {
      // "Bryant's" is "Bryant"; "London-based" is "London"; "New York City"
      // is the pin city "New York".
      const key = token
        .trim()
        .toLowerCase()
        .replace(/['\u2019]s$/, "")
        .replace(/-(based|born|raised|bred)$/, "");
      if (key.length < 2) continue;
      if (COMMON_NON_NAMES.has(key)) continue;
      if (allowed.has(key)) continue;
      if (allowed.has(key.replace(/\s+city$/, ""))) continue;
      if (addressLower.includes(key)) continue;

      const tokenWords = key.replace(/\s+city$/, "").split(/\s+/);
      const allowedByWord = [...allowed].some((name) => {
        const parts = name.split(/[\s\u2013\u2014-]+/);
        return tokenWords.every((w) => parts.includes(w));
      });
      if (allowedByWord) continue;

      unknown.push(token);
    }
  }
  return [...new Set(unknown)];
}

function matchedTerms(text: string, pattern: RegExp): string[] {
  const global = new RegExp(pattern.source, "gi");
  return [...new Set(text.match(global) ?? [])];
}

export function validatePitchPayload(
  pitch: PitchPayload,
  /** Place names the tools verified but the card doesn't show (pin city, borough). */
  extraAllowed: (string | undefined)[] = [],
): PitchValidationResult {
  const blob = [
    pitch.moodLine,
    pitch.headlinerWhy,
    pitch.openerWhy,
    pitch.widenRoomNote ?? "",
  ].join(" ");

  // Return the offending words so the one compose retry knows what to drop.
  if (INTERNAL_JARGON.test(blob)) {
    return {
      ok: false,
      reason: "internal_jargon",
      unknownNames: matchedTerms(blob, INTERNAL_JARGON),
    };
  }

  if (SUBJECTIVE_CLAIMS.test(blob)) {
    return {
      ok: false,
      reason: "subjective_claims",
      unknownNames: matchedTerms(blob, SUBJECTIVE_CLAIMS),
    };
  }

  if (FORBIDDEN_CLAIMS.test(blob)) {
    return { ok: false, reason: "forbidden_forecast_language", unknownNames: [] };
  }

  const allowed = collectAllowedNames(pitch);
  for (const n of extraAllowed) {
    if (n && n.trim().length > 2) allowed.add(n.trim().toLowerCase());
  }
  const unknownNames = findUnknownProperNames(blob, allowed, pitch.address);
  if (unknownNames.length > 0) {
    return { ok: false, reason: "unknown_entities", unknownNames };
  }

  if (!allowed.has(pitch.headliner.name.trim().toLowerCase())) {
    return { ok: false, reason: "headliner_not_in_evidence", unknownNames: [] };
  }

  return { ok: true };
}
