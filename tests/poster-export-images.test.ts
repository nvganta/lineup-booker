import { describe, expect, it } from "vitest";
import {
  distinctPosterImageSrcs,
  withPosterExportImageCacheBust,
} from "@/lib/poster-export-images";

function mockImg(src: string, key: string) {
  return {
    getAttribute: (name: string) => (name === "src" ? src : null),
    setAttribute: (name: string, value: string) => {
      if (name === "src") src = value;
    },
    get src() {
      return src;
    },
    set src(v: string) {
      src = v;
    },
    dataset: { posterImageKey: key },
  } as unknown as HTMLImageElement;
}

describe("poster export images", () => {
  it("assigns distinct cache-bust params per act image", async () => {
    const a = mockImg("/api/image-proxy/encoded-act-a-token", "act-a");
    const b = mockImg("/api/image-proxy/encoded-act-b-token", "act-b");
    const root = {
      querySelectorAll: () => [a, b],
    } as unknown as HTMLElement;

    const seen: string[] = [];
    await withPosterExportImageCacheBust(root, async () => {
      seen.push(...distinctPosterImageSrcs(root));
    });

    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
    expect(seen[0]).toContain("posterExport=act-a");
    expect(seen[1]).toContain("posterExport=act-b");
  });
});
