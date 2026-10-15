import { describe, expect, it, vi } from "vitest";
import { filterNeighborhoodLocalities } from "@/lib/lineup/geography";
import type { LocalityRow } from "@/lib/lineup/geography";

vi.mock("@/lib/geocode/nominatim", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/geocode/nominatim")>();
  return {
    ...actual,
    geocodeLocalityNearPin: vi.fn(
      async (name: string, pin: { lat: number; lon: number; city: string }) => {
        if (name === "Mount Pleasant") {
          return {
            lat: pin.lat + 0.001,
            lon: pin.lon + 0.001,
            displayName: name,
            cityForHeatmap: pin.city,
            state: "British Columbia",
            country: "Canada",
            address: { city: pin.city, suburb: "Mount Pleasant" },
          };
        }
        if (name === "Arizona") {
          return {
            lat: 33.4,
            lon: -111.7,
            displayName: "Arizona",
            cityForHeatmap: "Phoenix",
            address: { city: "Phoenix", state: "Arizona" },
          };
        }
        return null;
      },
    ),
    reverseGeocodeNeighborhood: vi.fn(async (lat: number, lon: number) => ({
      value: {
        lat,
        lon,
        name: "Mount Pleasant",
        placeType: "suburb",
        placeClass: "place",
        address: { suburb: "Mount Pleasant", city: "Vancouver" },
      },
      fromCache: true,
    })),
  };
});

describe("filterNeighborhoodLocalities", () => {
  it("keeps nearby localities in the same city", async () => {
    const pin = {
      lat: 49.2635,
      lon: -123.101,
      city: "Vancouver",
      state: "British Columbia",
      country: "Canada",
    };

    const entities: LocalityRow[] = [
      {
        name: "Mount Pleasant",
        disambiguation: "Vancouver, British Columbia",
        query: { affinity: 0.9 },
      },
      { name: "Arizona", disambiguation: "United States" },
      { name: "Canada", disambiguation: "Canada" },
    ];

    const { kept, audit } = await filterNeighborhoodLocalities(entities, pin);
    expect(kept.map((k) => k.name)).toEqual(["Mount Pleasant"]);
    expect(audit.find((a) => a.name === "Arizona")?.kept).toBe(false);
  });
});
