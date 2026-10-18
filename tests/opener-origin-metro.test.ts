import { describe, expect, it } from "vitest";
import {
  artistOriginMatchesVenue,
  originHasSpecificLocality,
  type VenuePin,
} from "@/lib/lineup/geography";

const brooklynPin: VenuePin = {
  lat: 40.7,
  lon: -73.95,
  city: "Brooklyn",
  displayCity: "New York",
  state: "New York",
  borough: "Brooklyn",
  county: "Kings County",
};

const shoreditchPin: VenuePin = {
  lat: 51.52,
  lon: -0.08,
  city: "Shoreditch",
  displayCity: "London",
  borough: "Hackney",
};

describe("artistOriginMatchesVenue metro rules", () => {
  it("treats NYC borough origins as local to a Brooklyn venue", () => {
    expect(artistOriginMatchesVenue("New York City", brooklynPin)).toBe(true);
    expect(artistOriginMatchesVenue("Brooklyn, New York City", brooklynPin)).toBe(
      true,
    );
    expect(artistOriginMatchesVenue("Queens, New York", brooklynPin)).toBe(true);
  });

  it("treats London neighbourhood origins as local to Shoreditch", () => {
    expect(artistOriginMatchesVenue("Dalston", shoreditchPin)).toBe(true);
    expect(artistOriginMatchesVenue("London", shoreditchPin)).toBe(true);
  });

  it("does not treat country-only origins as specific localities", () => {
    expect(originHasSpecificLocality("United Kingdom")).toBe(false);
    expect(originHasSpecificLocality("United States")).toBe(false);
  });
});
