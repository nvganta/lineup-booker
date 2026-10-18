import { describe, expect, it } from "vitest";
import { bookerStepLabel } from "@/lib/agent/step-copy";
import type { AgentSessionState } from "@/lib/agent/types";

describe("bookerStepLabel headliner rank", () => {
  it("words non-lead picks by rank in pool", () => {
    const session = {
      headlinerEntity: { id: "h", name: "Fixture Headliner" },
      headlinerRankInPool: 2,
      headlinerPoolSize: 8,
    } as AgentSessionState;
    const label = bookerStepLabel("headliner", {
      session,
      modelWhy: "",
      verdict: { level: "good", reasons: [] },
    });
    expect(label).toBe("Picked #2 of 8 acts for room fit.");
    expect(label).not.toContain("leads 8");
  });
});
