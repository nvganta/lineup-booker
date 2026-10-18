/** Reject scraped text that is clearly not a geographic origin. */
export function isPlausiblePlaceOrigin(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 120) return false;
  const lower = t.toLowerCase();
  if (/\b(novel|book|film|movie|album|song|television|tv series)\b/i.test(lower)) {
    return false;
  }
  if (/\bby [a-z]/i.test(lower) && /\b(novel|book)\b/i.test(lower)) return false;
  if (/^(a|an|the)\s+/i.test(lower) && !/\b(city|town|county|borough)\b/i.test(lower)) {
    return false;
  }
  if (/^\d{4}$/.test(t)) return false;
  if (/\bfestival\b/i.test(lower)) return false;
  if (/\bwomad\b/i.test(lower)) return false;
  if (/\blineup\b/i.test(lower) && /[,;]/.test(t)) return false;
  const segments = t.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (segments.length >= 3 && /\bfest\b/i.test(lower)) return false;
  if (segments.length >= 3 && /\b(19|20)\d{2}\b/.test(t)) return false;
  if (segments.length >= 4) return false;
  // "Some Ensemble, Venue, Venue" reads like a bill, not a hometown.
  if (
    segments.length >= 3 &&
    /\b(orchestra|orkestra|ensemble|band|choir|collective)\b/i.test(lower)
  ) {
    return false;
  }
  if (segments.length >= 5) return false;
  return true;
}
