/** Short venue name for the poster — not the full owner paste. */
export function venueDisplayName(concept: string): string {
  let text = concept.trim();
  text = text.replace(/,\s*\d+\s*-?\s*(?:seat|capacity)\b/gi, "");
  text = text.replace(/\b\d+\s*(-?\s*)?(?:seat|capacity)\b/gi, "");
  text = text.replace(/\b\d+\s*seats?\b/gi, "");
  text = text.split(/[—–]/)[0]?.trim() ?? text;
  const comma = text.indexOf(",");
  if (comma > 0 && comma < 48) {
    text = text.slice(0, comma).trim();
  }
  if (text.length > 56) {
    text = `${text.slice(0, 53).trim()}…`;
  }
  return text || "Your venue";
}

/**
 * Venue title as the owner typed it (capacity included), falling back to the
 * short display name when the paste is too long for the poster header.
 */
export function typedVenueLabel(concept: string | undefined | null): string {
  const typed = concept?.trim() ?? "";
  if (typed && typed.length <= 80) return typed;
  return venueDisplayName(typed);
}
