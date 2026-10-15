import { describe, expect, it } from "vitest";
import {
  REVERSE_GEOCODE_ZOOM,
  isPromotablePlaceType,
  isPromotableReverseGeocode,
  looksLikeStreetName,
  neighborhoodLabelFromReverse,
  type ReverseGeocodeResult,
} from "@/lib/geocode/nominatim";

describe("reverse geocode neighbourhood labels", () => {
  it("uses zoom 14 for suburb-level detail", () => {
    expect(REVERSE_GEOCODE_ZOOM).toBe(14);
  });

  it("reads suburb from address, not street display name", () => {
    const hit: ReverseGeocodeResult = {
      lat: 49.26,
      lon: -123.1,
      name: "Seymour Street",
      placeType: "secondary",
      placeClass: "highway",
      address: {
        suburb: "Mount Pleasant",
        road: "Seymour Street",
      },
    };
    expect(neighborhoodLabelFromReverse(hit)).toBe("Mount Pleasant");
  });

  it("accepts boundary administrative hits when suburb is in address", () => {
    const hit: ReverseGeocodeResult = {
      lat: 49.26,
      lon: -123.1,
      name: "Mount Pleasant",
      placeType: "administrative",
      placeClass: "boundary",
      adminLevel: 9,
      address: {
        suburb: "Mount Pleasant",
        city: "Vancouver",
      },
    };
    expect(isPromotableReverseGeocode(hit)).toBe(true);
    expect(
      isPromotablePlaceType("administrative", "boundary", {
        hasNeighborhoodAddress: true,
        adminLevel: 9,
      }),
    ).toBe(true);
  });

  it("rejects city-level administrative boundaries without neighbourhood address", () => {
    expect(
      isPromotablePlaceType("administrative", "boundary", {
        adminLevel: 8,
        hasNeighborhoodAddress: false,
      }),
    ).toBe(false);
  });

  it("rejects street-like labels", () => {
    expect(looksLikeStreetName("Main St")).toBe(true);
    expect(looksLikeStreetName("Mount Pleasant")).toBe(false);
    const hit: ReverseGeocodeResult = {
      lat: 49.26,
      lon: -123.1,
      name: "Main Street",
      placeType: "suburb",
      placeClass: "place",
      address: { suburb: "Main Street" },
    };
    expect(neighborhoodLabelFromReverse(hit)).toBeNull();
  });
});
