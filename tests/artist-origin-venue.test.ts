import { describe, expect, it } from "vitest";
import { artistOriginMatchesVenue } from "@/lib/lineup/geography";

describe("artistOriginMatchesVenue", () => {
  const torontoPin = {
    lat: 43.65,
    lon: -79.38,
    city: "Toronto",
    state: "Ontario",
    country: "Canada",
    suburb: "Parkdale",
  };

  it("does not treat country, province, or demonym as local", () => {
    expect(artistOriginMatchesVenue("Canada", torontoPin)).toBe(false);
    expect(artistOriginMatchesVenue("Canadian", torontoPin)).toBe(false);
    expect(artistOriginMatchesVenue("Ontario, Canada", torontoPin)).toBe(false);
    expect(
      artistOriginMatchesVenue("Ontario, Canada", {
        ...torontoPin,
        suburb: "Ontario",
      }),
    ).toBe(false);
  });

  it("does not treat a different city in the same country as local", () => {
    expect(
      artistOriginMatchesVenue(
        "St. John's, Newfoundland and Labrador, Canada",
        torontoPin,
      ),
    ).toBe(false);
    expect(
      artistOriginMatchesVenue("Fixtureville, Ontario, Canada", {
        lat: 43.65,
        lon: -79.38,
        city: "Fixtureton",
        suburb: "Fixture Heights",
      }),
    ).toBe(false);
  });

  it("matches the venue city or an exact suburb hint", () => {
    expect(artistOriginMatchesVenue("Toronto, Ontario", torontoPin)).toBe(true);
    expect(
      artistOriginMatchesVenue("Parkdale, Toronto", {
        ...torontoPin,
        suburb: "Parkdale",
      }),
    ).toBe(true);
  });
});
