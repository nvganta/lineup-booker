import { describe, expect, it } from "vitest";
import {
  homeLabelFromAddress,
  prependHomeToPromoteList,
  promoteListWithHomeFirst,
} from "@/lib/lineup/venue-home-area";
import type { NeighborhoodCandidate } from "@/lib/lineup/heatmap-neighborhoods";
import { isNonPromotableNeighborhoodLabel } from "@/lib/lineup/geography";

describe("venue home neighbourhood", () => {
  it("prepends the pin neighbourhood as rank 1", () => {
    const pin = { lat: 40.71, lon: -73.96, city: "New York" };
    const list = prependHomeToPromoteList(
      [{ rank: 1, name: "Fixture Flats", lat: 40.72, lon: -73.95 }],
      pin,
      "Fixture Heights",
    );
    expect(list[0]?.name).toBe("Fixture Heights");
    expect(list[0]?.rank).toBe(1);
    expect(list.some((n) => n.name === "Fixture Flats")).toBe(true);
  });

  it("forces the pin neighbourhood first when heatmap only finds distant areas", () => {
    const pin = {
      lat: 40.716,
      lon: -73.963,
      city: "New York",
      suburb: "Williamsburg",
      borough: "Brooklyn",
    };
    const merged: NeighborhoodCandidate[] = [
      {
        name: "Fixture Bushwick",
        score: 0.9,
        source: "grid",
        distanceKm: 4.3,
        lat: 40.705,
        lon: -73.92,
      },
    ];
    const list = promoteListWithHomeFirst(
      merged,
      pin,
      "Williamsburg",
      pin.city,
    );
    expect(list[0]?.name).toBe("Williamsburg");
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects electoral-style X Centre labels", () => {
    const pin = { lat: 43.65, lon: -79.38, city: "Toronto" };
    expect(isNonPromotableNeighborhoodLabel("Toronto Centre", pin)).toBe(true);
    expect(isNonPromotableNeighborhoodLabel("City Centre", pin)).toBe(false);
  });
});

describe("home label from the venue address", () => {
  it("prefers the quarter over a borough-level suburb", () => {
    const pin = {
      lat: 0,
      lon: 0,
      city: "Fixtureton",
      borough: "Fixture Borough",
    };
    expect(
      homeLabelFromAddress(
        { quarter: "Fixture Flats", suburb: "Fixture Borough", city: "Fixtureton" },
        pin,
      ),
    ).toBe("Fixture Flats");
  });
});
