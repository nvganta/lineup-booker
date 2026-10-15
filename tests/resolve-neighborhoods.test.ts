import { describe, expect, it } from "vitest";
import { mergeNeighborhoodCandidates } from "@/lib/lineup/heatmap-neighborhoods";

describe("resolve neighbourhood merge", () => {
  it("combines grid and locality candidates by Qloo score", () => {
    const merged = mergeNeighborhoodCandidates([
      { name: "Strathcona", score: 1, source: "locality" },
      { name: "Mount Pleasant", score: 0.97, source: "locality" },
      { name: "Seymour St", score: 0.99, source: "grid" },
      { name: "Grandview-Woodland", score: 0.85, source: "locality" },
      { name: "Downtown Eastside", score: 0.95, source: "locality" },
      { name: "Kensington-Cedar Cottage", score: 0.9, source: "locality" },
    ]);

    expect(merged[0]?.name).toBe("Strathcona");
    expect(merged.map((m) => m.name)).toContain("Mount Pleasant");
    expect(merged.map((m) => m.name)).toContain("Downtown Eastside");
    expect(merged.length).toBeGreaterThanOrEqual(5);
  });
});
