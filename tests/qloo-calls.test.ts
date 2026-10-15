import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/qloo/client", () => ({
  qlooGet: vi.fn(async () => ({
    data: { results: { entities: [] } },
    request: { method: "GET", path: "/v2/insights", query: "take=10" },
  })),
}));

describe("fetchArtistHeatmap", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("requests grid heatmap and locality boundary heatmap", async () => {
    const { qlooGet } = await import("@/lib/qloo/client");
    vi.mocked(qlooGet).mockImplementation(async (_path, params) => ({
      data: {
        results: {
          heatmap: params["output.heatmap.boundary"]
            ? undefined
            : [{ location: { latitude: 1, longitude: 2 }, query: { affinity: 1 } }],
          entities: params["output.heatmap.boundary"]
            ? [{ name: "Strathcona", query: { affinity: 1 } }]
            : [],
        },
      },
      request: {
        method: "GET",
        path: "/v2/insights",
        query: String(params["output.heatmap.boundary"] ?? "grid"),
      },
    }));

    const { fetchArtistHeatmap } = await import("@/lib/lineup/qloo-calls");
    const requests: import("@/lib/lineup/translate-venue").ProvenanceRequest[] =
      [];
    const result = await fetchArtistHeatmap("artist-1", "Vancouver", requests);

    expect(vi.mocked(qlooGet)).toHaveBeenCalledTimes(2);
    const boundaryCalls = vi
      .mocked(qlooGet)
      .mock.calls.filter(
        (c) =>
          (c[1] as Record<string, string>)["output.heatmap.boundary"] ===
          "urn:entity:locality",
      );
    expect(boundaryCalls).toHaveLength(1);
    expect(result.localities.map((l) => l.name)).toContain("Strathcona");
    expect(result.grid.length).toBeGreaterThan(0);
  });
});

describe("discoverOpeners", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not request explainability", async () => {
    const { qlooGet } = await import("@/lib/qloo/client");
    const { discoverOpeners } = await import("@/lib/lineup/qloo-calls");

    await discoverOpeners(
      {
        musicTagIds: ["urn:tag:genre:music:indie"],
        signalLocationPoint: "POINT(-123 49)",
        locationQuery: "Vancouver",
        cityForHeatmap: "Vancouver",
        locationMode: "point",
        tagIds: [],
        tagLabels: [],
        signalSummary: "",
      },
      "headliner-id",
      0.8,
      [],
    );

    const call = vi.mocked(qlooGet).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(call["feature.explainability"]).toBeUndefined();
  });
});
