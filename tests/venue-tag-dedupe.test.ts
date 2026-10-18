import { describe, expect, it } from "vitest";
import { normalizeVenueTagNameKey } from "@/lib/lineup/pitch-analytics";

/** Raw Brooklyn-style tags seen in live Qloo runs. */
const BROOKLYN_NEIGHBORHOOD_BAR_VARIANTS = [
  "Neighborhood Bar",
  "Neighbourhood Bar",
  "Neighborhood Bars",
] as const;

describe("normalizeVenueTagNameKey", () => {
  it("collapses Brooklyn neighbourhood bar variants to one key", () => {
    const keys = BROOKLYN_NEIGHBORHOOD_BAR_VARIANTS.map((raw) =>
      normalizeVenueTagNameKey(raw),
    );
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("neighborhood bar");
  });
});
