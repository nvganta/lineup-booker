import { describe, expect, it } from "vitest";
import { ordinal, popularityPercentileLine } from "@/lib/copy/ordinal";

describe("ordinal", () => {
  it("uses correct suffixes including teens", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(62)).toBe("62nd");
    expect(ordinal(83)).toBe("83rd");
  });

  it("formats popularity percentile lines", () => {
    expect(popularityPercentileLine(0.62)).toContain("62nd");
  });
});
