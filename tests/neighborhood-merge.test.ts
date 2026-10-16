import { describe, expect, it } from "vitest";
import { mergeNeighborhoodCandidates } from "@/lib/lineup/heatmap-neighborhoods";

describe("mergeNeighborhoodCandidates", () => {
  it("dedupes contained neighbourhood names", () => {
    const merged = mergeNeighborhoodCandidates([
      {
        name: "University",
        score: 0.9,
        source: "locality",
        distanceKm: 2,
      },
      {
        name: "University–Rosedale",
        score: 0.88,
        source: "locality",
        distanceKm: 2.1,
      },
    ]);
    expect(merged.map((m) => m.name)).toEqual(["University"]);
  });
});
