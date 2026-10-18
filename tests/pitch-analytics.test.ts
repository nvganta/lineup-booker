import { describe, expect, it } from "vitest";
import { headlinerWhyFromQloo } from "@/lib/lineup/act-why-lines";
import {
  overlapDisplayLabel,
  parseCompareOverlap,
} from "@/lib/lineup/pitch-analytics";

describe("pitch analytics helpers", () => {
  it("builds rank why line from discovery pool", () => {
    const line = headlinerWhyFromQloo({
      cityLabel: "Vancouver",
      tagLabels: ["Indie folk"],
      headlinerRankInPool: 2,
      headlinerPoolSize: 12,
    });
    expect(line).toContain("#2");
    expect(line).toContain("12");
    expect(line).toContain("Vancouver");
  });

  it("parses compare tag-level shared taste", () => {
    const parsed = parseCompareOverlap({
      results: {
        tags: [
          { name: "Indie folk", query: { affinity: 0.82 } },
          { name: "Folk", query: { affinity: 0.71 } },
        ],
      },
    });
    expect(parsed?.value).toBe(0.82);
    const label = overlapDisplayLabel(
      parsed!,
      "Fixture Headliner",
      "Fixture Opener",
    );
    expect(label).toBe("Strongest shared taste: Indie folk, 0.82");
    expect(parsed?.method).toBe("compare");
  });
});
