/** Safe filename slug (no commas or path chars). */
export function slugifyFilename(text: string, maxLen = 48): string {
  const slug = text
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const base = slug || "lineup";
  if (base.length <= maxLen) return base;
  const window = base.slice(0, maxLen + 1);
  const lastDash = window.lastIndexOf("-");
  if (lastDash > 8) return window.slice(0, lastDash);
  return base.slice(0, maxLen);
}
