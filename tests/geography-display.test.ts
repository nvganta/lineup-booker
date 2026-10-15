import { describe, expect, it } from "vitest";
import {
  displayNeighborhoodName,
  sameLocalityArea,
  type VenuePin,
} from "@/lib/lineup/geography";
import type { GeocodeResult } from "@/lib/geocode/nominatim";

describe("displayNeighborhoodName", () => {
  it('labels bare Downtown as "Downtown City"', () => {
    expect(displayNeighborhoodName("Downtown", "Vancouver")).toBe(
      "Downtown Vancouver",
    );
  });
});

describe("sameLocalityArea", () => {
  const venue: VenuePin = {
    lat: 51.52,
    lon: -0.08,
    city: "Greater London",
    state: "England",
    country: "United Kingdom",
    county: "Greater London",
    stateDistrict: "Greater London",
  };

  it("matches borough geocodes via shared county / state_district", () => {
    const hackney: GeocodeResult = {
      lat: 51.55,
      lon: -0.05,
      displayName: "Hackney",
      cityForHeatmap: "London",
      state: "England",
      county: "Greater London",
      stateDistrict: "Greater London",
      address: { city: "London", state_district: "Greater London" },
    };
    expect(sameLocalityArea(venue, hackney)).toBe(true);
  });
});
