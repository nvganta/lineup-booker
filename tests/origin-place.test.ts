import { describe, expect, it } from "vitest";
import { isPlausiblePlaceOrigin } from "@/lib/lineup/origin-place";

describe("isPlausiblePlaceOrigin", () => {
  it("rejects novel and book scrape lines", () => {
    expect(isPlausiblePlaceOrigin("a novel by Fixture Author Name")).toBe(false);
    expect(isPlausiblePlaceOrigin("Fixture Title, a novel")).toBe(false);
  });

  it("rejects festival list scrape lines", () => {
    expect(
      isPlausiblePlaceOrigin(
        "Fixture Fest, Other Fest, Third Fest, Fourth Fest",
      ),
    ).toBe(false);
    expect(
      isPlausiblePlaceOrigin(
        "Fixture Folk Ensemble, Harbor Fest, Ridge Festival, 2012",
      ),
    ).toBe(false);
    expect(
      isPlausiblePlaceOrigin(
        "Fixture World Fest lineup: Fixture Act, Other Act, Third Act",
      ),
    ).toBe(false);
  });

  it("rejects a short bill that starts with an ensemble name", () => {
    expect(
      isPlausiblePlaceOrigin("Fixture Brass Orchestra, Harbor Hall, Ridge Room"),
    ).toBe(false);
  });

  it("accepts normal city origins", () => {
    expect(isPlausiblePlaceOrigin("Brooklyn, New York City")).toBe(true);
    expect(isPlausiblePlaceOrigin("Fixture Prairie, Alberta, Canada")).toBe(
      true,
    );
  });
});
