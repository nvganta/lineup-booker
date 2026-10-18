/** Prefer a higher-res Qloo CDN variant when the default thumb is 420px wide. */
export function upgradeQlooArtistImageUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();
  if (/-420x-auto\.jpg$/i.test(trimmed)) {
    return trimmed.replace(/-420x-auto\.jpg$/i, "-840x-auto.jpg");
  }
  return trimmed;
}
