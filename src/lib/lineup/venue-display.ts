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
