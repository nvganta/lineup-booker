import { describe, expect, it } from "vitest";
import {
  dedupeVenueTasteTagList,
  normalizeVenueTagNameKey,
} from "@/lib/lineup/pitch-analytics";

const BROOKLYN_RAW = [
  "Neighborhood Dive Bar",
  "Neighborhood Bar",
  "Local Neighborhood Bar",
] as const;

describe("dedupeVenueTagsByWordSubset", () => {
  it("prints Brooklyn raw keys then keeps the most specific tag", () => {
    const keys = BROOKLYN_RAW.map((raw) => normalizeVenueTagNameKey(raw));
    expect(keys).toEqual([
      "neighborhood dive bar",
      "neighborhood bar",
      "local neighborhood bar",
    ]);
    const tags = BROOKLYN_RAW.map((name, i) => ({
      id: `t${i}`,
      name,
      source: "concept" as const,
    }));
    const out = dedupeVenueTasteTagList(tags);
    expect(out.map((t) => t.name)).toEqual(["Neighborhood Dive Bar"]);
  });
});
