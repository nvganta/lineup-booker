import { describe, expect, it } from "vitest";
import { isAreaLikeHit, type GeocodeResult } from "@/lib/geocode/nominatim";
import {
  displayNeighborhoodName,
  isNonPromotableNeighborhoodLabel,
  sameBoroughAsPin,
  type VenuePin,
} from "@/lib/lineup/geography";

const hit = (placeClass: string, placeType: string): GeocodeResult => ({
  lat: 0,
  lon: 0,
  displayName: "Fixture",
  cityForHeatmap: "Fixtureton",
  placeClass,
  placeType,
});

describe("promo area rules", () => {
  it("keeps a sibling neighbourhood when the city has no boroughs", () => {
    const pin: VenuePin = {
      lat: 0,
      lon: 0,
      city: "Fixtureton",
      suburb: "Fixture Heights",
    };
    expect(
      sameBoroughAsPin(pin, { neighbourhood: "Fixture Flats", city: "Fixtureton" }),
    ).toBe(true);
  });

  it("only accepts area-like geocode hits for neighbourhood names", () => {
    expect(isAreaLikeHit(hit("place", "suburb"))).toBe(true);
    expect(isAreaLikeHit(hit("boundary", "administrative"))).toBe(true);
    expect(isAreaLikeHit(hit("amenity", "restaurant"))).toBe(false);
    expect(isAreaLikeHit(hit("boundary", "political"))).toBe(false);
  });
});

describe("venue borough label", () => {
  it("does not promote the venue's own borough where boroughs are towns", () => {
    const pin: VenuePin = {
      lat: 0,
      lon: 0,
      city: "London",
      borough: "Hackney",
    };
    expect(isNonPromotableNeighborhoodLabel("Hackney", pin)).toBe(true);
    expect(isNonPromotableNeighborhoodLabel("Fixture Flats", pin)).toBe(false);
  });

  it("keeps the district and the next one over where boroughs are districts", () => {
    const neukoelln: VenuePin = {
      lat: 52.4839891,
      lon: 13.439361,
      city: "Berlin",
      country: "Deutschland",
      suburb: "Neukölln",
      borough: "Neukölln",
    };
    expect(isNonPromotableNeighborhoodLabel("Neukölln", neukoelln)).toBe(false);
    expect(
      sameBoroughAsPin(neukoelln, {
        suburb: "Kreuzberg",
        borough: "Friedrichshain-Kreuzberg",
        city: "Berlin",
      }),
    ).toBe(true);
  });
});

describe("display and address forms", () => {
  it("drops a civic-body suffix from an area name", () => {
    expect(
      displayNeighborhoodName("Fixture Hills Neighborhood Council District", "Fixtureton"),
    ).toBe("Fixture Hills");
  });
});
