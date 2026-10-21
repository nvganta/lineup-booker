import { describe, expect, it } from "vitest";
import { isModelStallError, isModelUnavailableError } from "@/lib/agent/model-fallback";
import { regularsPhrases, scoutBrief } from "@/lib/agent/scout-setup";
import { createEmptySession } from "@/lib/agent/runtime";

describe("scout setup", () => {
  it("splits regulars on the owner's commas only", () => {
    expect(regularsPhrases("Indie folk and vinyl nights")).toEqual(["Indie folk and vinyl nights"]);
    expect(regularsPhrases("Soul, jazz, and electronic")).toEqual(["Soul", "jazz", "and electronic"]);
    expect(regularsPhrases("  ")).toEqual(["live music"]);
  });

  it("briefs the model on what setup found, and what's still missing", () => {
    const empty = scoutBrief(createEmptySession());
    expect(empty).toContain("Venue NOT pinned");
    expect(empty).toContain("No music tags yet");

    const s = createEmptySession();
    s.pin = { lat: 49.26, lon: -123.1, city: "Vancouver", displayCity: "Vancouver", suburb: "Mount Pleasant" };
    s.band = { headlinerMin: 0.65, headlinerMax: 0.88, openerMax: 0.85, seatCapacity: 300 };
    s.tagIds = ["urn:tag:genre:music:indie_folk"];
    s.tagLabels = ["Indie - Folk"];
    s.headlinerEntity = { id: "A1", name: "Jordan Klassen" };
    const brief = scoutBrief(s);
    expect(brief).toContain("Venue pinned in Vancouver (Mount Pleasant)");
    expect(brief).toContain("urn:tag:genre:music:indie_folk (Indie - Folk)");
    expect(brief).toContain("Headliner chosen: Jordan Klassen (A1)");
  });

  it("tells a stalled model apart from an unavailable one", () => {
    const stall = new Error("The operation was aborted due to timeout");
    stall.name = "TimeoutError";
    expect(isModelStallError(stall)).toBe(true);
    expect(isModelStallError(new Error("Service temporarily unavailable"))).toBe(false);
    expect(isModelUnavailableError(new Error("Service temporarily unavailable"))).toBe(true);
    expect(isModelStallError(undefined)).toBe(false);
  });
});
