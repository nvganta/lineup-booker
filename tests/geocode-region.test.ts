import { describe, expect, it } from "vitest";
import { isOutsideTypedRegion, pickBestGeocodeResult, typedRegion, type GeocodeResult } from "@/lib/geocode/nominatim";

const hit = (displayName: string, address: GeocodeResult["address"]): GeocodeResult => ({
  lat: 0,
  lon: 0,
  displayName,
  cityForHeatmap: address?.city ?? "",
  address,
});

const lenoir = hit("Austin Lane, Lenoir County, North Carolina, 28572, United States", {
  road: "Austin Lane",
  county: "Lenoir County",
  state: "North Carolina",
  "ISO3166-2-lvl4": "US-NC",
  country: "United States",
  country_code: "us",
});

describe("keeping the pin in the state or country typed", () => {
  it("reads the region from the end of the address", () => {
    expect(typedRegion("1001 Lenoir St, Austin, TX")).toBe("tx");
    expect(typedRegion("1 Rivington St, London")).toBeUndefined();
  });

  it("drops a street-name match in another state", () => {
    expect(isOutsideTypedRegion(lenoir, "tx")).toBe(true);
    expect(pickBestGeocodeResult([lenoir], "1001 Lenoir St, Austin, TX")).toBeNull();
  });

  it("keeps hits whose region matches by code, name or country alias", () => {
    const vancouver = hit("2509 Main Street, Mount Pleasant, Vancouver, British Columbia, Canada", {
      city: "Vancouver",
      state: "British Columbia",
      "ISO3166-2-lvl4": "CA-BC",
      country: "Canada",
      country_code: "ca",
    });
    expect(isOutsideTypedRegion(vancouver, "bc")).toBe(false);
    expect(isOutsideTypedRegion(vancouver, "british columbia")).toBe(false);
    expect(isOutsideTypedRegion(hit("Shoreditch, London, England, United Kingdom", { country_code: "gb" }), "uk")).toBe(false);
    // The last part is a city, not a region: it still has to appear on the hit.
    expect(isOutsideTypedRegion(hit("Sunset Boulevard, Silver Lake, Los Angeles, California, United States", {}), "los angeles")).toBe(false);
  });
});
