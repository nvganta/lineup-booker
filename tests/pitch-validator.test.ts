import { describe, expect, it } from "vitest";
import {
  collectAllowedNames,
  findUnknownProperNames,
  validatePitchPayload,
} from "@/lib/agent/pitch-validator";

const base = {
  venueLabel: "Fixture wine bar",
  address: "2509 Main St, Vancouver, BC",
  headliner: { id: "h1", name: "Fixture Alpha" },
  opener: { id: "o1", name: "Fixture Beta" },
  alternates: [],
  neighborhoods: [{ rank: 1, name: "Mount Pleasant" }],
  evidenceFootnotes: {},
};

describe("validatePitchPayload", () => {
  it("allows sentence-initial capitalized words", () => {
    const result = validatePitchPayload({
      ...base,
      moodLine: "Fixture Alpha brings the room up without overselling.",
      headlinerWhy: "Fixture Alpha matches indie folk tags at your pin.",
      openerWhy: "Fixture Beta has local overlap.",
    });
    expect(result.ok).toBe(true);
  });

  it("allows address tokens in copy", () => {
    const result = validatePitchPayload({
      ...base,
      moodLine: "Main Street energy without a stadium bill.",
      headlinerWhy: "Fixture Alpha fits Vancouver rooms like yours.",
      openerWhy: "Fixture Beta opens.",
    });
    expect(result.ok).toBe(true);
  });

  it("allows DJ Fixture and Fjöra Fixture when in evidence", () => {
    const result = validatePitchPayload({
      ...base,
      headliner: { id: "h1", name: "DJ Fixture" },
      moodLine: "DJ Fixture fits a late set.",
      headlinerWhy: "DJ Fixture ranks on your tags.",
      openerWhy: "Fixture Beta opens.",
      alternates: [{ id: "a1", name: "Fjöra Fixture" }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invented mid-sentence names", () => {
    const result = validatePitchPayload({
      ...base,
      moodLine: "Surprise guest Zed Zeppelin appears.",
      headlinerWhy: "Fixture Alpha fits.",
      openerWhy: "Fixture Beta opens.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unknown_entities");
  });

  it("blocks subjective artist praise", () => {
    const result = validatePitchPayload({
      ...base,
      moodLine: "A warm night.",
      headlinerWhy: "Fixture Alpha brings emotive vocals to your room.",
      openerWhy: "Fixture Beta opens.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("subjective_claims");
  });

  it("blocks sold-out and forecast language", () => {
    const result = validatePitchPayload({
      ...base,
      moodLine: "This will sell out guaranteed.",
      headlinerWhy: "Fixture Alpha fits.",
      openerWhy: "Fixture Beta opens.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden_forecast_language");
  });
});

describe("validatePitchPayload owner-facing copy", () => {
  it("rejects tool names, scores and tag ids", () => {
    for (const leak of [
      "Fixture Alpha was picked by scout_after_headliner.",
      "Fixture Alpha sits at 0.87 on the scale.",
      "Fixture Alpha has the right popularity.",
    ]) {
      const result = validatePitchPayload({
        ...base,
        moodLine: "A warm night.",
        headlinerWhy: leak,
        openerWhy: "Fixture Beta opens.",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("internal_jargon");
    }
  });
});

describe("possessive names", () => {
  it("accepts a possessive form of an allowed name", () => {
    expect(
      findUnknownProperNames(
        "The room fits Fixture Celeb's late set.",
        new Set(["fixture celeb"]),
        "",
      ),
    ).toEqual([]);
  });
});

describe("place-name forms", () => {
  it("accepts -based, a City suffix, and a dash-split neighbourhood part", () => {
    expect(
      findUnknownProperNames(
        "A London-based act. New York City crowd. Draw from Rosedale.",
        new Set(["london", "new york", "university–rosedale"]),
        "",
      ),
    ).toEqual([]);
  });
});

describe("address abbreviations", () => {
  it("allows the spelled-out street from an abbreviated address", () => {
    const allowed = collectAllowedNames({
      ...base,
      address: "1 Fixture High St, Fixtureton",
    } as never);
    expect(allowed.has("fixture high street")).toBe(true);
  });
});
