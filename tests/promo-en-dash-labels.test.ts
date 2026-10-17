import { describe, expect, it } from "vitest";
import {
  isNonPromotableNeighborhoodLabel,
  promoLabelHasEnOrEmDash,
  type VenuePin,
} from "@/lib/lineup/geography";

const pin: VenuePin = { lat: 43.65, lon: -79.38, city: "Toronto" };

describe("promo en/em dash labels", () => {
  it("drops en-dash and em-dash compounds (Canadian ridings)", () => {
    expect(promoLabelHasEnOrEmDash("Parkdale–High Park")).toBe(true);
    expect(promoLabelHasEnOrEmDash("University—Rosedale")).toBe(true);
    expect(isNonPromotableNeighborhoodLabel("Parkdale–High Park", pin)).toBe(
      true,
    );
  });

  it("keeps plain-hyphen neighbourhood names", () => {
    expect(promoLabelHasEnOrEmDash("Kensington-Cedar Cottage")).toBe(false);
    expect(isNonPromotableNeighborhoodLabel("Kensington-Cedar Cottage", pin)).toBe(
      false,
    );
    expect(isNonPromotableNeighborhoodLabel("Bedford-Stuyvesant", pin)).toBe(
      false,
    );
  });
});
