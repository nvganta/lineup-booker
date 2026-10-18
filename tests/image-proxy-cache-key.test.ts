import { describe, expect, it } from "vitest";
import { htmlToImageDefaultCacheKey } from "@/lib/image-proxy-encode";
import { proxiedImageUrl } from "@/lib/image-proxy";

describe("image proxy paths vs html-to-image cache keys", () => {
  const urlA = "https://images.qloo.com/path/fixture-act-a.jpg";
  const urlB = "https://images.qloo.com/path/fixture-act-b.jpg";

  it("documents the query-proxy bug: different images share one cache key", () => {
    const legacyA = `/api/image-proxy?url=${encodeURIComponent(urlA)}`;
    const legacyB = `/api/image-proxy?url=${encodeURIComponent(urlB)}`;
    expect(legacyA).not.toBe(legacyB);
    expect(htmlToImageDefaultCacheKey(legacyA)).toBe(
      htmlToImageDefaultCacheKey(legacyB),
    );
  });

  it("path-based proxy URLs stay distinct under default html-to-image cache keys", () => {
    const pathA = proxiedImageUrl(urlA)!;
    const pathB = proxiedImageUrl(urlB)!;
    expect(pathA).not.toBe(pathB);
    expect(pathA.startsWith("/api/image-proxy/")).toBe(true);
    expect(htmlToImageDefaultCacheKey(pathA)).not.toBe(
      htmlToImageDefaultCacheKey(pathB),
    );
  });
});
