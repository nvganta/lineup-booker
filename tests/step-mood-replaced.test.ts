import { describe, expect, it } from "vitest";
import { bookerStepLabel, humanizeVerdictReason } from "@/lib/agent/step-copy";
import type { AgentSessionState } from "@/lib/agent/types";

describe("mood_line_replaced pitch step", () => {
  it("uses plain words and hides internal detail", () => {
    const session = {} as AgentSessionState;
    const label = bookerStepLabel("pitch", {
      session,
      modelWhy: "Compose final pitch with headliner Fixture A.",
      verdict: { level: "weak", reasons: ["mood_line_replaced"] },
    });
    expect(label).toBe("Pitch locked — used a plain room line.");
    expect(humanizeVerdictReason("mood_line_replaced")).toBe("");
  });
});
