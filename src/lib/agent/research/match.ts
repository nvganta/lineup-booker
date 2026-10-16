const MUSICIAN_HINT =
  /\b(singer|songwriter|musician|band|rapper|dj|composer|vocalist|drummer|guitarist|pianist|producer|hip hop|rock band|pop group|indie rock|folk|electronic music artist)\b/i;

const NON_MUSICIAN_HINT =
  /\b(city|town|village|province|state|film|movie|novel|politician|football|soccer|basketball|river|mountain|airport|university)\b/i;

export function normalizeArtistName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

/** "Fixture Artist (musician)" → "fixture artist"; "The Fixture Band" → "fixture band". */
function comparableName(name: string): string {
  return normalizeArtistName(name.replace(/\s*\([^)]*\)\s*$/, "")).replace(
    /^the /,
    "",
  );
}

/**
 * Exact name match only (ignoring case, punctuation, a leading "The" and a
 * Wikipedia disambiguation suffix). Substring or first/last-name matches
 * pulled in other people, e.g. "Fixture" → "Fixture Alpha".
 */
export function namesMatch(candidateTitle: string, artistName: string): boolean {
  const a = comparableName(artistName);
  const b = comparableName(candidateTitle);
  return Boolean(a) && a === b;
}

export function isPrimarilyActorDescription(description: string): boolean {
  const text = description.trim();
  if (!/\b(actress|actor)\b/i.test(text)) return false;
  if (MUSICIAN_HINT.test(text) && hasMusicCareerCue(text)) return false;
  return true;
}

function hasMusicCareerCue(text: string): boolean {
  return /\b(singer|musician|band|rapper|songwriter|vocalist)\b/i.test(text);
}

export function isClearlyMusician(
  description: string,
  title: string,
  artistName: string,
): boolean {
  if (!namesMatch(title, artistName)) return false;
  const text = description.trim();
  if (!text) return false;
  if (isPrimarilyActorDescription(text)) return false;
  if (NON_MUSICIAN_HINT.test(text) && !MUSICIAN_HINT.test(text)) return false;
  return MUSICIAN_HINT.test(text);
}

const CONFLICTING_NON_MUSICIAN =
  /\b(comics? writer|graphic novelist|novelist|author|screenwriter|journalist|essayist|illustrator)\b/i;

/** Same name, different career — used to detect ambiguous bench rows. */
export function isConflictingNonMusicianProfile(
  description: string,
  title: string,
  artistName: string,
): boolean {
  if (!namesMatch(title, artistName)) return false;
  const text = description.trim();
  if (!text) return false;
  if (isClearlyMusician(text, title, artistName)) return false;
  if (CONFLICTING_NON_MUSICIAN.test(text) && !MUSICIAN_HINT.test(text)) {
    return true;
  }
  return NON_MUSICIAN_HINT.test(text) && !MUSICIAN_HINT.test(text);
}

export function firstSentence(text: string, maxLen = 220): string | undefined {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  const m = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  const sentence = (m ? m[1] : trimmed.slice(0, maxLen)).trim();
  if (sentence.length > maxLen) return `${sentence.slice(0, maxLen - 1).trim()}…`;
  return sentence;
}
