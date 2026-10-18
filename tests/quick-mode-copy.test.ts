import { describe, expect, it } from "vitest";
import { lineupToPitch } from "@/lib/agent/quick-mode";
import type { AgentSessionState } from "@/lib/agent/types";

describe("full Quick mode copy", () => {
  it("uses the plain catalog lines, not stock filler", () => {
    const lineup = {
      venueLabel: "Fixture Room",
      headliner: { id: "h1", name: "Fixture Alpha" },
      opener: { id: "o1", name: "Fixture Beta" },
      alternates: [],
      neighborhoods: [],
    } as unknown as Parameters<typeof lineupToPitch>[1];
    const prior = { tagLabels: ["Indie Folk", "Folk"] } as unknown as AgentSessionState;
    const pitch = lineupToPitch(
      { concept: "Fixture Room", location: "1 Fixture St" } as Parameters<typeof lineupToPitch>[0],
      lineup,
      prior,
    );
    expect(pitch.moodLine).toBe("An indie folk night sized for your room.");
    expect(pitch.headlinerWhy).toContain("Fixture Alpha is the right size for this room");
    expect(pitch.openerWhy).toBe(
      "Fixture Beta fits the room's opener slot in the same lane as Fixture Alpha.",
    );
  });
});
