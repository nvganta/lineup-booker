import { describe, expect, it } from "vitest";
import { markAgainstQloo } from "@/lib/compare/qloo-overlap";
import { claimsLocal, markNeighbourhood, markOrigin, markRoomFit, parsePlainAnswer } from "@/lib/compare/without-qloo";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";
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

  it("checks the opener's hometown because the prompt asked for a local one", () => {
    const quiet = { name: "Fern Static", why: "folk", local: false };
    expect(markOrigin(quiet, "Norwich, England", pin, true)).toEqual([{ ok: false, text: "From Norwich, England" }]);
  });

  it("marks a headliner against the room's popularity band", () => {
    const band = popularityBandFromConcept("Cafe-bar, 300 capacity");
    expect(markRoomFit(0.47, band)).toEqual([{ ok: false, text: "Too small to headline · 47th percentile on Qloo" }]);
    expect(markRoomFit(0.97, band)).toEqual([{ ok: false, text: "Too big for a 300-cap room · 97th percentile on Qloo" }]);
    expect(markRoomFit(0.8, band)).toEqual([{ ok: true, text: "Fits a 300-cap room · 80th percentile on Qloo" }]);
    expect(markRoomFit(undefined, band)).toEqual([]);
  });

  it("matches a poster spot to a Qloo pick by name or by a nearby pin", () => {
    const qloo = [
      { rank: 1, name: "Mount Pleasant", lat: 49.2627, lon: -123.1013 },
      { rank: 3, name: "Downtown Eastside", lat: 49.2824, lon: -123.0995 },
    ];
    expect(markAgainstQloo("Mount-Pleasant", null, qloo)).toEqual({ ok: true, text: "Qloo #1" });
    expect(markAgainstQloo("Main & Broadway", { lat: 49.2628, lon: -123.1009 }, qloo)).toEqual({ ok: true, text: "Qloo #1" });
    // Gastown sits 0.5 km from Downtown Eastside's centroid: a neighbour, not the same area.
    expect(markAgainstQloo("Gastown", { lat: 49.2837, lon: -123.1062 }, qloo)).toEqual({ ok: false, soft: true, text: "not in Qloo's top 5" });
    expect(markAgainstQloo("Nowhere", null, qloo)).toBeNull();
  });
});
