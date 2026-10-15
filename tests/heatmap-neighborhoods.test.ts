import { describe, expect, it, vi } from "vitest";
import heatmapFixture from "./fixtures/insights.heatmap.json";
import { collectGridNeighborhoodCandidates } from "@/lib/lineup/heatmap-neighborhoods";

vi.mock("@/lib/geocode/nominatim", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/geocode/nominatim")>();
  return {
    ...actual,
    reverseGeocodeNeighborhood: vi.fn(async (lat: number, lon: number) => ({
      value: {
        lat,
        lon,
        name: "Astoria Street",
        placeType: "suburb",
        placeClass: "place",
        address: { suburb: "Astoria" },
      },
      fromCache: false,
    })),
  };
});

describe("neighborhoodsFromHeatmapGrid", () => {
  it("reverse-geocodes nearby high-affinity cells only", async () => {
    const pin = {
      lat: 40.74,
      lon: -73.88,
      city: "New York",
    };
    const grid = heatmapFixture.results.heatmap;
    const { candidates, audit } = await collectGridNeighborhoodCandidates(
      grid,
      pin,
    );
    const neighborhoods = candidates.map((c, i) => ({
      name: c.name,
      rank: i + 1,
    }));

    expect(neighborhoods.length).toBeGreaterThan(0);
    expect(audit.some((a) => a.kept)).toBe(true);
    expect(neighborhoods[0]?.name).toBeTruthy();
  });
});
