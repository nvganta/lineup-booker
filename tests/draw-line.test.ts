import { describe, expect, it } from "vitest";
import { drawLine, drawTier } from "@/lib/lineup/draw-line";

describe("drawTier", () => {
  it("bands popularity into owner-sized tiers", () => {
    expect(drawTier(0.3)).toBe("rising");
    expect(drawTier(0.7)).toBe("mid");
    expect(drawTier(0.85)).toBe("big");
    expect(drawTier(0.95)).toBe("headline");
  });
});

describe("drawLine", () => {
  it("names the room when capacity is known", () => {
    const d = drawLine(0.72, 300);
    expect(d?.label).toBe("Mid-size draw");
    expect(d?.percentile).toBe(72);
    expect(d?.line).toBe(
      "72nd percentile for listener reach on Qloo. Sized for a 300-cap room.",
    );
  });

  it("falls back to a small room without capacity", () => {
    expect(drawLine(0.5, undefined)?.line).toContain("fill a small room");
  });

  it("returns null without a popularity", () => {
    expect(drawLine(undefined, 200)).toBeNull();
    expect(drawLine(Number.NaN, 200)).toBeNull();
  });
});
