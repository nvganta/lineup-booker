import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  TOP_GRID_CELLS,
  mergeNeighborhoodCandidates,
  rankHeatmapCells,
} from "@/lib/lineup/heatmap-neighborhoods";
import { clearNominatimMemoryCache } from "@/lib/geocode/nominatim";

const pin = { lat: 49.26, lon: -123.1, city: "Vancouver" };

describe("heatmap grid determinism", () => {
  beforeEach(() => {
    clearNominatimMemoryCache();
    vi.restoreAllMocks();
  });

  it("always evaluates a fixed top-N cells by affinity", () => {
    const grid = Array.from({ length: 20 }, (_, i) => ({
      location: { latitude: pin.lat + i * 0.001, longitude: pin.lon + i * 0.001 },
      query: { affinity: 1 - i * 0.01 },
    }));
    const ranked = rankHeatmapCells(grid, pin);
    expect(ranked.length).toBeLessThanOrEqual(TOP_GRID_CELLS);
  });

  it("dedupes merged candidates by name keeping highest score", () => {
    const merged = mergeNeighborhoodCandidates([
      { name: "Strathcona", score: 0.9, source: "locality" },
      { name: "strathcona", score: 1, source: "grid" },
      { name: "Mount Pleasant", score: 0.8, source: "locality" },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.name.toLowerCase()).toBe("strathcona");
    expect(merged[0]?.score).toBe(1);
  });
});
