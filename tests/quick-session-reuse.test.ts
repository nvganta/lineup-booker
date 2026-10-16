import { describe, expect, it, vi } from "vitest";
import { runQuickMode } from "@/lib/agent/quick-mode";
import { createStreamWriter } from "@/lib/agent/stream-writer";
import type { AgentSessionState } from "@/lib/agent/types";

vi.mock("@/lib/lineup/build-lineup", () => ({
  buildLineup: vi.fn(async () => {
    throw new Error("buildLineup should not run when session has a headliner");
  }),
}));

describe("Quick mode session reuse", () => {
  it("reuses the headliner without calling buildLineup", async () => {
    const session = {
      headlinerEntity: { id: "h1", name: "Fixture Alpha" },
      tagLabels: ["Indie Folk"],
      neighborhoods: [
        { rank: 1, name: "Fixture Echo", lat: 34.09, lon: -118.26 },
        { rank: 2, name: "Fixture Silver", lat: 34.08, lon: -118.25 },
      ],
      pin: {
        lat: 34.09,
        lon: -118.26,
        city: "Fixture City",
        suburb: "Fixture Silver",
        homeNeighborhood: "Fixture Silver",
      },
      tagIds: [],
      tagOperator: "union" as const,
      widenLevel: 0 as const,
      refineUsed: new Set<string>(),
      knownTagIds: new Set<string>(),
      knownNames: new Set<string>(),
      knownIds: new Set<string>(),
    } satisfies AgentSessionState;

    const writer = createStreamWriter({ write: () => {} });
    const pitch = await runQuickMode(
      {
        concept: "Fixture room",
        location: "1 Main St",
        regularsLove: "indie folk",
      },
      writer,
      Date.now() - 500,
      4,
      session,
    );

    expect(pitch.headliner.name).toBe("Fixture Alpha");
    expect(pitch.neighborhoods[0]?.name).toBe("Fixture Silver");
  });
});
