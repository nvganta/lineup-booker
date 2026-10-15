import { describe, expect, it } from "vitest";
import {
  cityLabelsEquivalent,
  isNonPromotableNeighborhoodLabel,
  isStatisticalRegionLabel,
  isVenueCityName,
} from "@/lib/lineup/geography";
import {
  mergeNeighborhoodCandidates,
  neighborhoodRankingScore,
} from "@/lib/lineup/heatmap-neighborhoods";

const pin = { lat: 51.526, lon: -0.078, city: "London" };

describe("non-promotable neighbourhood labels", () => {
  it("treats London and Greater London as the same city label", () => {
    const greaterLondonPin = { ...pin, city: "Greater London" };
    expect(cityLabelsEquivalent("London", "Greater London")).toBe(true);
    expect(isVenueCityName("London", greaterLondonPin)).toBe(true);
  });

  it("rejects NUTS-style statistical region labels", () => {
    expect(isStatisticalRegionLabel("Inner London - East")).toBe(true);
    expect(isStatisticalRegionLabel("Outer London - North")).toBe(true);
    expect(isStatisticalRegionLabel("Shoreditch")).toBe(false);
  });

  it("rejects city rows, boroughs, and housing estates", () => {
    expect(isNonPromotableNeighborhoodLabel("London", pin)).toBe(true);
    expect(
      isNonPromotableNeighborhoodLabel(
        "City of Westminster",
        pin,
        "City of Westminster, London, England",
      ),
    ).toBe(true);
    expect(isNonPromotableNeighborhoodLabel("Falcons Estate", pin)).toBe(true);
    expect(isNonPromotableNeighborhoodLabel("Shoreditch", pin)).toBe(false);
  });
});

describe("neighbourhood ranking by proximity", () => {
  it("prefers nearer areas when Qloo affinity is similar", () => {
    const merged = mergeNeighborhoodCandidates([
      {
        name: "Millbank",
        score: 0.92,
        source: "locality",
        distanceKm: 4.2,
      },
      {
        name: "Shoreditch",
        score: 0.9,
        source: "locality",
        distanceKm: 0.4,
      },
    ]);

    expect(merged[0]?.name).toBe("Shoreditch");
    expect(neighborhoodRankingScore(merged[0]!)).toBeGreaterThan(
      neighborhoodRankingScore(merged[1]!),
    );
  });
});
