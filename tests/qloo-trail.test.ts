import { describe, expect, it } from "vitest";
import type { PitchPayload } from "@/lib/agent/types";
import { buildTrail, receiptStep } from "@/lib/qloo/trail";

const insights = (params: Record<string, string>, results = 1) => ({
  path: "/v2/insights",
  params,
  results,
  cached: false,
});

describe("receiptStep", () => {
  it("files each request under its stop", () => {
    expect(receiptStep({ path: "/v2/tags", params: {}, results: 1, cached: false })).toBe("tags");
    expect(receiptStep(insights({ "filter.type": "urn:entity:artist", "signal.interests.tags": "t" }))).toBe("pool");
    expect(receiptStep(insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": "A1" }))).toBe("opener");
    expect(receiptStep(insights({ "filter.type": "urn:heatmap" }))).toBe("neighborhoods");
    expect(receiptStep(insights({ "filter.type": "urn:demographics" }))).toBe("crowd");
    expect(receiptStep(insights({ "filter.type": "urn:entity:artist", "filter.results.entities": "A1,B2" }))).toBe("numbers");
    expect(receiptStep({ path: "/v2/analysis/compare", params: {}, results: 0, cached: true })).toBe("numbers");
  });
});

describe("buildTrail", () => {
  const pitch: PitchPayload = {
    venueLabel: "Fixture bar",
    address: "1 Main St, Testville",
    moodLine: "",
    headlinerWhy: "",
    openerWhy: "Local act whose origin matches this city.",
    headliner: { id: "A1", name: "Fixture Head" },
    opener: { id: "B2", name: "Fixture Open" },
    alternates: [],
    neighborhoods: [],
    evidenceFootnotes: {},
    meta: { concept: "Wine bar, 120 seats", regularsLove: "indie folk", headlinerPoolSize: 9, headlinerRankInPool: 2 },
    qlooCalls: [
      { path: "/v2/tags", params: { "filter.query": "indie folk" }, results: 1, cached: false },
      insights({ "filter.type": "urn:entity:artist", "signal.interests.tags": "t", "filter.popularity.min": "0.6", "filter.popularity.max": "0.85" }, 12),
      insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": "A1" }, 10),
      insights({ "filter.type": "urn:heatmap", "signal.interests.entities": "A1" }, 40),
      insights({ "filter.type": "urn:demographics", "signal.interests.entities": "A1" }, 1),
    ],
  };

  it("walks room to numbers with a stat per stop and the receipts attached", () => {
    const trail = buildTrail({
      pitch,
      analytics: null,
      cityLabel: "Testville",
      capacity: 120,
      tagLabels: ["indie folk"],
      crowdLine: "Skews 35–44 · leans male",
      neighborhoodNames: ["North", "South", "East"],
    });
    expect(trail.map((n) => n.id)).toEqual(["room", "tags", "pool", "headliner", "opener", "neighborhoods", "crowd"]);
    expect(trail[2]).toMatchObject({ stat: "9 acts", receipts: [pitch.qlooCalls![1]] });
    expect(trail[2]?.line).toContain("popularity 0.60 to 0.85");
    expect(trail[3]).toMatchObject({ stat: "#2" });
    expect(trail[3]?.line).toContain("#2 of 9");
    expect(trail[5]?.line).toBe("From the fan heatmap for Fixture Head: North, South and East.");
    expect(trail[6]?.stat).toBe("35–44");
  });

  it("drops stops with nothing behind them", () => {
    const bare = buildTrail({
      pitch: { ...pitch, opener: null, qlooCalls: [], meta: {} },
      analytics: null,
      tagLabels: [],
      crowdLine: null,
      neighborhoodNames: [],
    });
    expect(bare.map((n) => n.id)).toEqual(["room", "headliner"]);
  });
});
