import { describe, expect, it } from "vitest";
import {
  isMeaningfulOverlapTag,
  parseCompareOverlap,
} from "@/lib/lineup/pitch-analytics";

describe("overlap tag filtering", () => {
  it("ignores generic compare tags", () => {
    expect(isMeaningfulOverlapTag("United States")).toBe(false);
    expect(isMeaningfulOverlapTag("Drums")).toBe(false);
    expect(isMeaningfulOverlapTag("Indie folk")).toBe(true);
  });

  it("returns null when only generic tags are present", () => {
    const parsed = parseCompareOverlap({
      results: {
        tags: [
          { name: "United States", query: { affinity: 1 } },
          { name: "Drums", query: { affinity: 0.98 } },
        ],
      },
    });
    expect(parsed).toBeNull();
  });
});
