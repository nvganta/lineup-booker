import { describe, expect, it } from "vitest";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";

describe("popularityBandFromConcept", () => {
  it("caps small rooms under 300 seats to mid-tier popularity", () => {
    const band = popularityBandFromConcept("Natural wine bar, 250 capacity");
    expect(band.headlinerMin).toBe(0.6);
    expect(band.headlinerMax).toBe(0.85);
    expect(band.seatCapacity).toBe(250);
  });

  it("caps 300-seat rooms below arena-tier popularity", () => {
    const band = popularityBandFromConcept("Listening room, 300 capacity");
    expect(band.headlinerMax).toBe(0.88);
    expect(band.seatCapacity).toBe(300);
  });
});
