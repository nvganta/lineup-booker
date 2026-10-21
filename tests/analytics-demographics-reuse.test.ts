import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<Record<string, unknown>> = [];

vi.mock("@/lib/qloo/client", () => ({
  qlooGet: vi.fn(async (path: string, params: Record<string, unknown>) => {
    calls.push({ path, ...params });
    return { data: { results: { entities: [], tags: [] } }, request: { method: "GET", path, query: "" } };
  }),
}));

import { buildPitchAnalytics, type PitchAnalyticsInput } from "@/lib/lineup/pitch-analytics";

const input: PitchAnalyticsInput = {
  cityQuery: "Vancouver",
  countryQuery: "Canada",
  cityLabel: "Vancouver",
  concept: "Cafe-bar, 300 capacity",
  regularsLove: "Indie folk",
  musicTagIds: [],
  headliner: { id: "A1", name: "Jordan Klassen" },
  opener: null,
  bench: [],
};

const demographicsCalls = () => calls.filter((c) => c["filter.type"] === "urn:demographics");

describe("pitch analytics demographics", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("reuses the scout's crowd instead of asking Qloo again", async () => {
    const crowd = { age: { "35_to_44": 0.77 }, gender: { male: 0.65, female: -0.65 } };
    const { analytics } = await buildPitchAnalytics({ ...input, crowdDemographics: crowd });
    expect(demographicsCalls()).toHaveLength(0);
    expect(analytics.demographics).toEqual(crowd);
  });

  it("still fetches when the pitch has no crowd", async () => {
    await buildPitchAnalytics(input);
    expect(demographicsCalls()).toHaveLength(1);
  });
});
