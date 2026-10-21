import { describe, expect, it } from "vitest";
import { describeReceipt, shortNumber, tagWords } from "@/lib/qloo/receipt-copy";
import { currentQlooReceipts, recordQlooCall, withQlooReceipts } from "@/lib/qloo/receipts";
import { parseSampleRuns } from "@/lib/sample-runs";

const names = new Map([
  ["A1", "Jordan Klassen"],
  ["B2", "Twin Bandit"],
]);

describe("Qloo receipts", () => {
  it("collects calls made inside a run, and only there", async () => {
    recordQlooCall("/search", { query: "outside" }, { results: [] }, false);
    const { receipts } = await withQlooReceipts(async () => {
      recordQlooCall("/v2/tags", { "filter.query": "indie folk", take: 1, empty: "" }, { results: { tags: [{}, {}] } }, false);
      await Promise.resolve();
      recordQlooCall("/v2/insights", { "filter.type": "urn:heatmap" }, { results: { heatmap: [{}] } }, true);
      expect(currentQlooReceipts()).toHaveLength(2);
    });
    expect(receipts).toEqual([
      { path: "/v2/tags", params: { "filter.query": "indie folk", take: "1" }, results: 2, cached: false },
      { path: "/v2/insights", params: { "filter.type": "urn:heatmap" }, results: 1, cached: true },
    ]);
  });

  it("says each call in plain words, with names for ids", () => {
    const heat = describeReceipt(
      { path: "/v2/insights", params: { "filter.type": "urn:heatmap", "signal.interests.entities": "A1", "filter.location.query": "Vancouver", "output.heatmap.boundary": "urn:entity:locality" }, results: 8, cached: false },
      names,
    );
    expect(heat.title).toBe("Mapped where Jordan Klassen's fans live in Vancouver, by neighbourhood");
    expect(heat.request).toContain("GET /v2/insights?filter.type=urn%3Aheatmap");

    const headliners = describeReceipt(
      { path: "/v2/insights", params: { "filter.type": "urn:entity:artist", "signal.interests.tags": "urn:tag:genre:music:indie_folk", "filter.popularity.min": "0.65", "filter.popularity.max": "0.88" }, results: 12, cached: false },
      names,
    );
    expect(headliners.title).toBe("Found indie folk acts near the venue, sized for the room (popularity 0.65–0.88)");
    expect(headliners.params).toContainEqual(["signal.interests.tags", "indie folk"]);

    const compare = describeReceipt(
      { path: "/v2/analysis/compare", params: { "a.signal.interests.entities": "A1", "b.signal.interests.entities": "B2" }, results: 0, cached: true },
      names,
    );
    expect(compare.title).toBe("Compared the tastes of Jordan Klassen and Twin Bandit fans");
    expect(tagWords("urn:tag:genre:music:indie_folk")).toBe("indie folk");
  });

  it("rounds long numbers for display but keeps them exact in the request", () => {
    expect(shortNumber("0.8014590312")).toBe("0.8");
    expect(shortNumber("0.655")).toBe("0.66");
    expect(shortNumber("0.65")).toBe("0.65");
    expect(shortNumber("20")).toBe("20");
    expect(shortNumber("POINT(-123.1013 49.2627)")).toBe("POINT(-123.1013 49.2627)");
    const line = describeReceipt({ path: "/v2/insights", params: { "filter.type": "urn:entity:artist", "signal.interests.tags": "urn:tag:genre:music:indie_folk", "filter.popularity.max": "0.8014590312" }, results: 3, cached: false }, names);
    expect(line.params).toContainEqual(["filter.popularity.max", "0.8"]);
    expect(line.title).toContain("(popularity 0–0.8)");
    expect(line.request).toContain("0.8014590312");
  });
});

describe("saved runs from env", () => {
  const run = { savedAt: "2026-10-20", venue: { lat: 1, lon: 2 }, pitch: { headliner: { id: "A1" } }, plain: { answer: {} }, analytics: { acts: [] } };

  it("reads raw or base64 JSON, and drops malformed runs", () => {
    const raw = JSON.stringify({ "1 Main St": run, "2 Bad St": { pitch: {} } });
    expect(Object.keys(parseSampleRuns(raw))).toEqual(["1 Main St"]);
    expect(Object.keys(parseSampleRuns(Buffer.from(raw).toString("base64")))).toEqual(["1 Main St"]);
    expect(parseSampleRuns(undefined)).toEqual({});
    expect(parseSampleRuns("not json")).toEqual({});
  });
});
