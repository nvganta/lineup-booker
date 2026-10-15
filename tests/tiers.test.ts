import { describe, expect, it } from "vitest";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";

describe("popularityBandFromConcept", () => {
  it("caps small rooms under 300 seats to mid-tier popularity", () => {
    const band = popularityBandFromConcept("Natural wine bar, 250 capacity");
    expect(band.headlinerMin).toBe(0.6);
    expect(band.headlinerMax).toBe(0.85);
  });
});
