import { describe, expect, it } from "vitest";
import { formatCrowdDisplay } from "@/lib/lineup/crowd-display";

describe("formatCrowdDisplay positive skew", () => {
  it("picks the highest positive age band, not the largest absolute negative", () => {
    const line = formatCrowdDisplay({
      age: {
        "35_to_44": 0.77,
        "45_to_54": -0.83,
      },
      gender: { male: -0.2, female: 0.15 },
    });
    expect(line).toContain("35–44");
    expect(line).not.toContain("45–54");
    expect(line).toContain("leans female");
  });

  it("shows no age skew when every band is negative", () => {
    const line = formatCrowdDisplay({
      age: { "45_to_54": -0.83, "55_to_64": -0.4 },
      gender: { male: -0.1, female: -0.05 },
    });
    expect(line).toBeNull();
  });
});
