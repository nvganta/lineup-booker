import { describe, expect, it, vi } from "vitest";
import {
  cleanRegularsPhrase,
  regularsPhrases,
} from "@/lib/lineup/genre-tags";

describe("regularsPhrases", () => {
  it("splits on commas and and", () => {
    expect(regularsPhrases("indie rock and dream pop")).toEqual([
      "indie rock",
      "dream pop",
    ]);
  });

  it("strips noise words but keeps jazz", () => {
    expect(cleanRegularsPhrase("live jazz nights")).toBe("jazz");
    expect(regularsPhrases("Indie folk and vinyl nights")).toEqual([
      "Indie folk",
    ]);
    expect(regularsPhrases("live jazz nights, indie folk")).toEqual([
      "jazz",
      "indie folk",
    ]);
  });

  it("dedupes repeated phrases", () => {
    expect(regularsPhrases("indie folk, indie folk")).toEqual(["indie folk"]);
  });
});

describe("resolveMusicGenreTags query dedupe", () => {
  it("does not search the same phrase twice", async () => {
    vi.mock("@/lib/qloo/client", () => ({
      qlooGet: vi.fn(async (_path: string, params: Record<string, string>) => ({
        data: {
          results: {
            tags: [
              {
                tag_id: "urn:tag:genre:music:indie_folk",
                name: "indie folk",
              },
            ],
          },
        },
        request: {
          method: "GET",
          path: "/v2/tags",
          query: String(params["filter.query"]),
        },
      })),
    }));

    const { resolveMusicGenreTags } = await import("@/lib/lineup/genre-tags");
    const { qlooGet } = await import("@/lib/qloo/client");
    await resolveMusicGenreTags("indie folk and indie folk", "", []);

    const queries = vi
      .mocked(qlooGet)
      .mock.calls.map((c) => c[1]?.["filter.query"]);
    const indieFolkQueries = queries.filter((q) => q === "indie folk");
    expect(indieFolkQueries.length).toBe(1);
  });

  it("never requests non-music genre tag types", async () => {
    vi.resetModules();
    vi.mock("@/lib/qloo/client", () => ({
      qlooGet: vi.fn(async () => ({
        data: { results: { tags: [] } },
        request: { method: "GET", path: "/v2/tags", query: "" },
      })),
    }));

    const { resolveMusicGenreTags } = await import("@/lib/lineup/genre-tags");
    const { qlooGet } = await import("@/lib/qloo/client");
    await resolveMusicGenreTags("indie folk", "natural wine bar", []);

    for (const call of vi.mocked(qlooGet).mock.calls) {
      const params = call[1] as Record<string, string>;
      expect(params["filter.tag.types"]).toBe("urn:tag:genre:music");
    }
  });
});
