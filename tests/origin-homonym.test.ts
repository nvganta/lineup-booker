import { describe, expect, it } from "vitest";
import {
  artistOriginMatchesVenue,
  originConflictsWithVenue,
  type VenuePin,
} from "@/lib/lineup/geography";

const shoreditch: VenuePin = {
  lat: 51.52,
  lon: -0.08,
  city: "Shoreditch",
  displayCity: "London",
  country: "United Kingdom",
};

const vancouverBc: VenuePin = {
  lat: 49.28,
  lon: -123.12,
  city: "Vancouver",
  state: "British Columbia",
  country: "Canada",
};

const brooklynNy: VenuePin = {
  lat: 40.7,
  lon: -73.95,
  city: "Brooklyn",
  displayCity: "New York",
  state: "New York",
  country: "United States",
  borough: "Brooklyn",
};

const toronto: VenuePin = {
  lat: 43.65,
  lon: -79.38,
  city: "Toronto",
  country: "Canada",
  state: "Ontario",
};

describe("origin homonyms and metro boroughs", () => {
  it("rejects London, Ontario for a London UK venue", () => {
    expect(originConflictsWithVenue("London, Ontario", shoreditch)).toBe(true);
    expect(artistOriginMatchesVenue("London, Ontario", shoreditch)).toBe(
      false,
    );
  });

  it("rejects Vancouver, Washington for Vancouver BC", () => {
    expect(artistOriginMatchesVenue("Vancouver, Washington", vancouverBc)).toBe(
      false,
    );
  });

  it("rejects Brooklyn, Michigan for Brooklyn NY", () => {
    expect(artistOriginMatchesVenue("Brooklyn, Michigan", brooklynNy)).toBe(
      false,
    );
  });

  it("accepts Scarborough, Ontario for a Toronto venue", () => {
    expect(artistOriginMatchesVenue("Scarborough, Ontario", toronto)).toBe(
      true,
    );
  });

  it("rejects Scarborough, North Yorkshire for a Toronto venue", () => {
    expect(
      artistOriginMatchesVenue("Scarborough, North Yorkshire", toronto),
    ).toBe(false);
  });
});
