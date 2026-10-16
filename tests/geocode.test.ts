import { describe, expect, it } from "vitest";
import {
  cityFromAddress,
  cityFromLocationText,
  geocodeAddressAttempts,
  neighborhoodHintsFromLocation,
  parseAddressForGeocode,
  pickBestGeocodeResult,
  scoreGeocodeResult,
  streetNameTokens,
  stripTrailingPostcodeToken,
  viewboxAroundPin,
  type GeocodeResult,
} from "@/lib/geocode/nominatim";

describe("cityFromAddress", () => {
  it("prefers structured city over street display_name", () => {
    expect(
      cityFromAddress({
        city: "Vancouver",
        state: "British Columbia",
        country: "Canada",
      }),
    ).toBe("Vancouver");
  });

  it("falls back from location text", () => {
    expect(cityFromLocationText("2509 Main St, Vancouver, BC")).toBe(
      "Vancouver",
    );
  });
});

describe("stripTrailingPostcodeToken", () => {
  it("strips UK outward-only postcode EC2A from London address", () => {
    expect(stripTrailingPostcodeToken("1 Rivington St, London EC2A")).toBe(
      "1 Rivington St, London",
    );
  });

  it("strips full UK postcode", () => {
    expect(
      stripTrailingPostcodeToken("1 Rivington St, London EC2A 3EA"),
    ).toBe("1 Rivington St, London");
  });
});

describe("geocodeAddressAttempts", () => {
  it("includes stripped postcode and street+city retries", () => {
    const attempts = geocodeAddressAttempts("1 Rivington St, London EC2A");
    expect(attempts[0]).toBe("1 Rivington St, London EC2A");
    expect(attempts).toContain("1 Rivington St, London");
  });

  it("parseAddressForGeocode splits street and city", () => {
    expect(parseAddressForGeocode("1 Rivington St, London EC2A")).toEqual({
      street: "1 Rivington St",
      city: "London",
    });
  });
});

describe("geocode ranking", () => {
  const typed = "2801 Sunset Blvd, Silver Lake, Los Angeles, CA";
  const parsed = parseAddressForGeocode(typed);
  const hints = neighborhoodHintsFromLocation(typed);

  it("extracts Silver Lake as a neighbourhood hint", () => {
    expect(hints.map((h) => h.toLowerCase())).toContain("silver lake");
  });

  it("prefers Silver Lake over Pacific Palisades for Sunset Blvd", () => {
    const silver: GeocodeResult = {
      lat: 34.09,
      lon: -118.27,
      displayName: "2801, West Sunset Boulevard, Silver Lake, Los Angeles, CA",
      cityForHeatmap: "Los Angeles",
      address: {
        house_number: "2801",
        road: "West Sunset Boulevard",
        suburb: "Silver Lake",
        city: "Los Angeles",
        state: "California",
        country: "United States",
      },
    };
    const palisades: GeocodeResult = {
      lat: 34.04,
      lon: -118.53,
      displayName: "Sunset Boulevard, Pacific Palisades, Los Angeles, CA",
      cityForHeatmap: "Los Angeles",
      address: {
        road: "Sunset Boulevard",
        suburb: "Pacific Palisades",
        city: "Los Angeles",
        state: "California",
      },
    };
    expect(
      scoreGeocodeResult(silver, typed, parsed, hints),
    ).toBeGreaterThan(scoreGeocodeResult(palisades, typed, parsed, hints));
    expect(pickBestGeocodeResult([palisades, silver], typed)?.address?.suburb).toBe(
      "Silver Lake",
    );
  });
});

describe("geocode ranking is general, not special-cased", () => {
  const fixture = (
    over: Partial<GeocodeResult> & { address: GeocodeResult["address"] },
  ): GeocodeResult => ({
    lat: 1,
    lon: 1,
    displayName: "",
    cityForHeatmap: "Fixtureton",
    ...over,
  });

  it("prefers the exact house number over a street-only hit listed first", () => {
    const typed = "12 Elm St, Fixtureton, ZZ";
    const streetOnly = fixture({
      displayName: "Elm Street, Farside, Fixtureton",
      address: { road: "Elm Street", suburb: "Farside", city: "Fixtureton" },
    });
    const exact = fixture({
      displayName: "12, Elm Street, Nearside, Fixtureton",
      address: {
        house_number: "12",
        road: "Elm Street",
        suburb: "Nearside",
        city: "Fixtureton",
      },
    });
    expect(pickBestGeocodeResult([streetOnly, exact], typed)?.address?.suburb).toBe(
      "Nearside",
    );
  });

  it("uses a typed neighbourhood when house numbers are missing", () => {
    const typed = "40 Oak Ave, Nearside, Fixtureton, ZZ";
    const far = fixture({
      displayName: "Oak Avenue, Farside, Fixtureton",
      address: { road: "Oak Avenue", suburb: "Farside", city: "Fixtureton" },
    });
    const near = fixture({
      displayName: "Oak Avenue, Nearside, Fixtureton",
      address: { road: "Oak Avenue", suburb: "Nearside", city: "Fixtureton" },
    });
    expect(pickBestGeocodeResult([far, near], typed)?.address?.suburb).toBe(
      "Nearside",
    );
  });

  it("matches abbreviated street names and directions", () => {
    expect(streetNameTokens("1088 Queen St W")).toEqual(["queen", "street"]);
    expect(streetNameTokens("West Queen Street")).toEqual(["queen", "street"]);
  });

  it("keeps Nominatim's order when nothing else separates candidates", () => {
    const typed = "Elm St, Fixtureton";
    const a = fixture({ displayName: "A", address: { road: "Elm Street", city: "Fixtureton" } });
    const b = fixture({ displayName: "B", address: { road: "Elm Street", city: "Fixtureton" } });
    expect(pickBestGeocodeResult([a, b], typed)?.displayName).toBe("A");
  });
});

describe("viewboxAroundPin", () => {
  it("builds nominatim viewbox string", () => {
    const box = viewboxAroundPin(51.52, -0.08, 6);
    expect(box.split(",")).toHaveLength(4);
  });
});
