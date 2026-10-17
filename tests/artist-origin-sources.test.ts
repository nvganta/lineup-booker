import { describe, expect, it, vi } from "vitest";
import { gatherArtistOriginTexts } from "@/lib/lineup/artist-origin-sources";

vi.mock("@/lib/agent/research/cache", () => ({
  getCachedArtistBackground: vi.fn(async () => ({
    origin: "Fixture Prairie, Alberta, Canada",
    knownFor: "From Fixture Prairie",
    sourceUrl: "https://example.com",
    sourceName: "Wikipedia" as const,
  })),
}));

vi.mock("@/lib/agent/research/research-artists", () => ({
  researchOneArtist: vi.fn(async () => null),
}));

describe("gatherArtistOriginTexts", () => {
  it("includes cached research-card origin and From line", async () => {
    const texts = await gatherArtistOriginTexts("Fixture Opener A", undefined);
    expect(texts).toContain("Fixture Prairie, Alberta, Canada");
  });
});
