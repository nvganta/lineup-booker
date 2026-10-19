import { describe, expect, it } from "vitest";
import { claimsLocal, markNeighbourhood, markOrigin, parsePlainAnswer } from "@/lib/compare/without-qloo";
import type { VenuePin } from "@/lib/lineup/geography";

const pin = { lat: 49.26, lon: -123.1, city: "Vancouver", displayCity: "Vancouver", country: "Canada" } as VenuePin;

describe("without Qloo marks", () => {
  it("parses a fenced JSON answer", () => {
    const a = parsePlainAnswer('```json\n{"headliner":{"name":"The Paper Gulls","why":"Warm folk","local":false},"opener":{"name":"Fern Static","why":"A Vancouver indie band","local":true},"neighbourhoods":["Harbour Flats","Elm Street"]}\n```');
    expect(a?.headliner.name).toBe("The Paper Gulls");
    expect(a?.neighbourhoods).toHaveLength(2);
  });

  it("returns null for junk", () => {
    expect(parsePlainAnswer("no idea")).toBeNull();
  });

  it("sees a local claim in the reason", () => {
    expect(claimsLocal({ name: "Fern Static", why: "Vancouver indie folk collective", local: false }, "Vancouver")).toBe(true);
    expect(claimsLocal({ name: "Fern Static", why: "Gentle indie folk", local: false }, "Vancouver")).toBe(false);
  });

  it("marks a wrong hometown only when local was claimed", () => {
    const claimed = { name: "Fern Static", why: "Vancouver band", local: true };
    expect(markOrigin(claimed, "Norwich, England", pin)).toEqual([{ ok: false, text: "From Norwich, England" }]);
    expect(markOrigin({ ...claimed, why: "folk", local: false }, "Norwich, England", pin)).toEqual([]);
    expect(markOrigin(claimed, undefined, pin)).toEqual([]);
    expect(markOrigin(claimed, "Canada", pin)).toEqual([]);
    expect(markOrigin(claimed, "Vancouver, British Columbia", pin)).toEqual([{ ok: true, text: "From Vancouver, British Columbia" }]);
  });

  it("marks a street and an area in another city, and nothing else", () => {
    const base = { lat: 0, lon: 0, displayName: "x" };
    expect(markNeighbourhood({ ...base, cityForHeatmap: "Vancouver", placeClass: "highway" }, pin)).toEqual({ ok: false, text: "a street" });
    expect(markNeighbourhood({ ...base, cityForHeatmap: "Burnaby", placeClass: "place" }, pin)).toEqual({ ok: false, text: "in Burnaby" });
    expect(markNeighbourhood({ ...base, cityForHeatmap: "Vancouver", placeClass: "place" }, pin)).toBeNull();
    expect(markNeighbourhood({ ...base, cityForHeatmap: "Burnaby", placeClass: "amenity" }, pin)).toBeNull();
    expect(markNeighbourhood(null, pin)).toBeNull();
  });
});
