import { describe, expect, it } from "vitest";
import {
  formatSkewIndex,
  genderSkewSummary,
} from "@/lib/lineup/crowd-skew-display";

describe("crowd skew display", () => {
  it("formats signed indexes without percent signs", () => {
    expect(formatSkewIndex(0.42)).toBe("+0.42");
    expect(formatSkewIndex(-0.77)).toBe("-0.77");
  });

  it("shows no clear gender skew when both are zero or missing", () => {
    expect(genderSkewSummary({ male: 0, female: 0 })).toBe(
      "no clear gender skew",
    );
    expect(genderSkewSummary(null)).toBe("no clear gender skew");
    expect(genderSkewSummary({ male: -0.2, female: -0.1 })).toBe(
      "no clear gender skew",
    );
  });
});
