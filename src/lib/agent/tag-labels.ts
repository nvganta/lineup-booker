/** Normalise adjacent-genre labels and drop junk variants. */
export function normalizeAdjacentGenreLabel(raw: string): string | null {
  let name = raw.trim().replace(/\s*-\s*$/g, "").replace(/\s+/g, " ");
  if (!name) return null;
  const compact = name.replace(/\s/g, "").toLowerCase();
  if (compact === "indiefolk") return "Indie folk";
  if (/^indie\s*folk\s*-/i.test(name)) return "Indie folk";
  if (name.endsWith(" -")) name = name.slice(0, -2).trim();
  if (!name) return null;
  return name;
}

export function dedupeTagsByLabel<T extends { id: string; name: string }>(
  tags: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of tags) {
    const label = normalizeAdjacentGenreLabel(t.name);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...t, name: label });
  }
  return out;
}
