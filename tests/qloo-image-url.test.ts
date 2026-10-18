import { describe, expect, it } from "vitest";
import { htmlToImageDefaultCacheKey } from "@/lib/image-proxy-encode";
import { proxiedImageUrl } from "@/lib/image-proxy";
import { upgradeQlooArtistImageUrl } from "@/lib/qloo-image-url";

describe("upgradeQlooArtistImageUrl", () => {
  it("requests 840px variant for default thumbs", () => {
    const url =
      "https://images.qloo.com/i/FAKE0000-0000-4000-8000-000000000001-420x-auto.jpg";
    expect(upgradeQlooArtistImageUrl(url)).toContain("840x-auto");
  });

  it("path proxies differ per source URL under html-to-image cache keys", () => {
    const a = proxiedImageUrl(
      "https://images.qloo.com/i/AAAA-420x-auto.jpg",
    )!;
    const b = proxiedImageUrl(
      "https://images.qloo.com/i/BBBB-420x-auto.jpg",
    )!;
    expect(htmlToImageDefaultCacheKey(a)).not.toBe(htmlToImageDefaultCacheKey(b));
  });
});
