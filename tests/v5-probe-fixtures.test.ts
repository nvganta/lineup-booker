import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isBroadRegion } from "@/lib/lineup/geography";
import { isPromotablePlaceType } from "@/lib/geocode/nominatim";

const FIXTURES = path.join(__dirname, "fixtures/probes");

function load(name: string) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
}

describe("v5 shoreditch probe regressions", () => {
  const shoreditch = load("fixture-shoreditch-a.json");

  it("marks county-level heatmap names as broad regions", () => {
    for (const name of ["Kent", "Surrey", "Essex", "England", "Greater London"]) {
      const row = shoreditch.neighborhoods.raw.find(
        (r: { name: string }) => r.name === name,
      );
      expect(row, name).toBeDefined();
      expect(isBroadRegion(name, row.disambiguation)).toBe(true);
    }
  });

  it("rejects county place types from reverse geocode", () => {
    expect(isPromotablePlaceType("county", "boundary")).toBe(false);
    expect(isPromotablePlaceType("suburb", "place")).toBe(true);
    expect(
      isPromotablePlaceType("administrative", "boundary", {
        hasNeighborhoodAddress: true,
        adminLevel: 10,
      }),
    ).toBe(true);
  });
});
