import { describe, expect, it } from "vitest";
import {
  verdictNeighborhoods,
  verdictTags,
  verdictVenue,
} from "@/lib/agent/verdicts";
import { validatePitchPayload } from "@/lib/agent/pitch-validator";
import { canUseRefine, consumeRefine, markRefineUsed } from "@/lib/agent/refine";
import { AgentBudget } from "@/lib/agent/budget";

describe("agent verdicts", () => {
  it("scores venue pin quality", () => {
    expect(verdictVenue(undefined).level).toBe("fail");
    expect(
      verdictVenue({ lat: 1, lon: 2, city: "Fixture City" }).level,
    ).toBe("good");
  });

  it("scores tag coverage", () => {
    expect(verdictTags(2, 0).level).toBe("fail");
    expect(verdictTags(2, 2).level).toBe("good");
  });

  it("scores neighborhood count", () => {
    expect(verdictNeighborhoods(4, false).level).toBe("good");
    expect(verdictNeighborhoods(2, false).level).toBe("weak");
  });
});

describe("pitch validator", () => {
  it("rejects unknown proper names", () => {
    const result = validatePitchPayload({
      venueLabel: "Fixture venue",
      address: "1 Main St, Fixture City",
      moodLine: "Fixture mood for the room.",
      headlinerWhy: "Fixture Alpha fits the room.",
      openerWhy: "Fixture Beta opens.",
      headliner: { id: "h1", name: "Fixture Alpha" },
      opener: { id: "o1", name: "Fixture Beta" },
      alternates: [],
      neighborhoods: [{ rank: 1, name: "Fixture District" }],
      evidenceFootnotes: {},
    });
    expect(result.ok).toBe(true);

    const bad = validatePitchPayload({
      venueLabel: "Fixture venue",
      address: "1 Main St",
      moodLine: "Surprise guest Zed Zeppelin appears.",
      headlinerWhy: "Fixture Alpha fits.",
      openerWhy: "Fixture Beta opens.",
      headliner: { id: "h1", name: "Fixture Alpha" },
      opener: null,
      alternates: [],
      neighborhoods: [],
      evidenceFootnotes: {},
    });
    expect(bad.ok).toBe(false);
  });
});

describe("refine strategies", () => {
  it("allows each strategy only once", () => {
    const used = new Set<string>();
    expect(markRefineUsed(used, "union_tags")).toBe(true);
    expect(canUseRefine(used, "union_tags")).toBe(false);
  });

  it("consumeRefine returns fail verdict on repeat", () => {
    const used = new Set<string>();
    expect(consumeRefine(used, "widen_band_1")).toBeNull();
    expect(consumeRefine(used, "widen_band_1")?.level).toBe("fail");
  });
});

describe("agent budget", () => {
  it("enforces qloo call cap", () => {
    const b = new AgentBudget();
    for (let i = 0; i < 16; i++) b.useQloo();
    expect(() => b.useQloo()).toThrow();
  });
});
