/** Strip a trailing venue city from labels like "Downtown Vancouver" → "Downtown". */
export function stripCityFromNeighborhoodLabel(
  name: string,
  venueCity?: string,
): string {
  const trimmed = name.trim();
  if (!venueCity) return trimmed;
  const city = venueCity.replace(/\bec\d[a-z]\d?\b/gi, "").trim();
  if (!city) return trimmed;

  const lower = trimmed.toLowerCase();
  const cityLower = city.toLowerCase();
  if (lower.endsWith(` ${cityLower}`)) {
    const rest = trimmed.slice(0, -(city.length + 1)).trim();
    // Only drop the city after a generic area word. "New Toronto" or
    // "East Vancouver" are real neighbourhood names, not "New" / "East".
    if (/^(downtown|midtown|uptown|central|inner)$/i.test(rest)) return rest;
  }
  return trimmed;
}
