import { describe, expect, it } from "vitest";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";

describe("stripCityFromNeighborhoodLabel", () => {
  it("removes trailing city names", () => {
    expect(stripCityFromNeighborhoodLabel("Downtown Vancouver", "Vancouver")).toBe(
      "Downtown",
    );
  });
});

describe("stripCityFromNeighborhoodLabel keeps real names", () => {
  it("does not cut a neighbourhood that merely ends with the city name", () => {
    expect(stripCityFromNeighborhoodLabel("New Fixtureton", "Fixtureton")).toBe(
      "New Fixtureton",
    );
    expect(stripCityFromNeighborhoodLabel("East Fixtureton", "Fixtureton")).toBe(
      "East Fixtureton",
    );
  });
});
