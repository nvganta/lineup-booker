import { describe, expect, it } from "vitest";
import {
  isMacroAdminNeighborhoodName,
  isNonPromotableNeighborhoodLabel,
  samePromotableLocalityArea,
  type VenuePin,
} from "@/lib/lineup/geography";
import type { GeocodeResult } from "@/lib/geocode/nominatim";

const williamsburgPin: VenuePin = {
  lat: 40.716,
  lon: -73.963,
  city: "New York",
  state: "New York",
  country: "United States",
  county: "Kings County",
  suburb: "Williamsburg",
  borough: "Brooklyn",
};

function geocodeStub(partial: Partial<GeocodeResult>): GeocodeResult {
  return {
    lat: 40.73,
    lon: -73.99,
    displayName: "Fixture locality",
    cityForHeatmap: "New York",
    state: "New York",
    country: "United States",
    address: {},
    ...partial,
  };
}

describe("NYC promo neighbourhood rules", () => {
  it("treats macro admin labels as non-promotable", () => {
    expect(isMacroAdminNeighborhoodName("Fixture County")).toBe(true);
    expect(isMacroAdminNeighborhoodName("Greater Fixtureton")).toBe(true);
    expect(
      isNonPromotableNeighborhoodLabel("Long Island", williamsburgPin),
    ).toBe(true);
    expect(
      isNonPromotableNeighborhoodLabel("Williamsburg", williamsburgPin),
    ).toBe(false);
  });

  it("drops fan-heat rows geocoded to a different NYC borough within 5 km", () => {
    const manhattanHit = geocodeStub({
      address: {
        borough: "Manhattan",
        suburb: "Alphabet City",
        city: "New York",
      },
      county: "New York County",
    });
    expect(samePromotableLocalityArea(williamsburgPin, manhattanHit)).toBe(
      false,
    );

    const brooklynHit = geocodeStub({
      address: {
        borough: "Brooklyn",
        suburb: "East Williamsburg",
        city: "New York",
      },
      county: "Kings County",
    });
    expect(samePromotableLocalityArea(williamsburgPin, brooklynHit)).toBe(true);
  });
});

describe("London Shoreditch promo rules", () => {
  it("allows Stamford Hill in Hackney within the 5 km locality band", () => {
    const shoreditchPin: VenuePin = {
      lat: 51.526,
      lon: -0.078,
      city: "London",
      borough: "Hackney",
    };
    const stamfordHit = geocodeStub({
      lat: 51.57,
      lon: -0.072,
      address: {
        suburb: "Stamford Hill",
        city: "London",
        borough: "Hackney",
      },
    });
    expect(samePromotableLocalityArea(shoreditchPin, stamfordHit)).toBe(true);
  });
});
