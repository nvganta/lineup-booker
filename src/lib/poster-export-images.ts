/** Distinct image src values under a poster root (for export sanity checks). */
export function distinctPosterImageSrcs(root: HTMLElement): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const img of root.querySelectorAll("img")) {
    const src = img.getAttribute("src")?.trim();
    if (!src || seen.has(src)) continue;
    seen.add(src);
    out.push(src);
  }
  return out;
}

/**
 * html-to-image can reuse cached bitmaps when multiple acts share a proxy path.
 * Stamp each img with a unique export query param for the duration of export.
 */
export function withPosterExportImageCacheBust(
  root: HTMLElement,
  run: () => Promise<void>,
): Promise<void> {
  const restores: Array<{ el: HTMLImageElement; src: string }> = [];
  let i = 0;
  for (const img of root.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (!src) continue;
    const key =
      img.dataset.posterImageKey?.trim() ||
      img.getAttribute("alt")?.trim() ||
      String(i);
    const sep = src.includes("?") ? "&" : "?";
    const busted = `${src}${sep}posterExport=${encodeURIComponent(key)}`;
    restores.push({ el: img, src });
    img.setAttribute("src", busted);
    i += 1;
  }
  return run().finally(() => {
    for (const { el, src } of restores) {
      el.setAttribute("src", src);
    }
  });
}
