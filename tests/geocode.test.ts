import { describe, expect, it } from "vitest";
import {
  cityFromAddress,
  cityFromLocationText,
  geocodeAddressAttempts,
  stripTrailingPostcodeToken,
  parseAddressForGeocode,
  viewboxAroundPin,
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

describe("viewboxAroundPin", () => {
  it("builds nominatim viewbox string", () => {
    const box = viewboxAroundPin(51.52, -0.08, 6);
    expect(box.split(",")).toHaveLength(4);
  });
});
