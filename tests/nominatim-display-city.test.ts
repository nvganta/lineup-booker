import { describe, expect, it } from "vitest";
import {
  displayCityLabelFromGeocode,
  type GeocodeResult,
} from "@/lib/geocode/nominatim";

describe("displayCityLabelFromGeocode", () => {
  it("uses London for Shoreditch-style two-part addresses", () => {
    const hit: GeocodeResult = {
      lat: 51.524,
      lon: -0.078,
      displayName: "134, Shoreditch High Street, Shoreditch, London, England",
      cityForHeatmap: "Shoreditch",
      address: {
        house_number: "134",
        road: "Shoreditch High Street",
        suburb: "Shoreditch",
        borough: "Hackney",
        city: "London",
        country: "United Kingdom",
      },
    };
    expect(displayCityLabelFromGeocode(hit)).toBe("London");
  });
});
