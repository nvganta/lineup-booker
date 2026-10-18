import { describe, expect, it } from "vitest";
import { stepBodyForDisplay } from "@/lib/agent/step-display";

describe("stepBodyForDisplay", () => {
  it("never surfaces model planning text from pitch why", () => {
    const body = stepBodyForDisplay({
      id: "p1",
      kind: "pitch",
      status: "done",
      label: "Pitch locked for the room.",
      why: "Compose final pitch with headliner Fixture A, opener Fixture B, and five promo neighborhoods.",
    });
    expect(body).toBeNull();
  });
});
