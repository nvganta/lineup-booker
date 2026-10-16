import { describe, expect, it } from "vitest";
import { venueDisplayName } from "@/lib/lineup/venue-display";

describe("venueDisplayName", () => {
  it("strips capacity from concept", () => {
    expect(
      venueDisplayName("Natural wine cafe-bar, 300 capacity"),
    ).toBe("Natural wine cafe-bar");
    expect(
      venueDisplayName("Neighborhood taco bar, 150 capacity"),
    ).toBe("Neighborhood taco bar");
  });
});
