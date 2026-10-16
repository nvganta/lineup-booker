import { describe, expect, it, vi, beforeEach } from "vitest";
import { runQuickMode } from "@/lib/agent/quick-mode";
import { createStreamWriter } from "@/lib/agent/stream-writer";
import type { StepDataPart } from "@/lib/agent/types";

vi.mock("@/lib/lineup/build-lineup", () => ({
  buildLineup: vi.fn(async () => ({
    venueLabel: "Fixture venue",
    eventLabel: "Live music night",
    headliner: {
      id: "h1",
      name: "Fixture Alpha",
      tierLabel: "Headliner",
    },
    opener: {
      id: "o1",
      name: "Fixture Beta",
      tierLabel: "Opener",
    },
    alternates: [],
    neighborhoods: [{ rank: 1, name: "Fixture District", lat: 1, lon: 2 }],
    venue: { lat: 1, lon: 2, city: "Fixture City" },
    provenance: { requests: [] },
  })),
}));

describe("quick mode fallback", () => {
  beforeEach(() => {
    process.env.QLOO_MOCK_TRANSPORT = "1";
  });

  it("emits pitch and summary", async () => {
    const steps: StepDataPart[] = [];
    const writer = createStreamWriter({
      write: (part) => {
        if (part.type === "data-step") steps.push(part.data as StepDataPart);
      },
    });
    const pitch = await runQuickMode(
      {
        concept: "Fixture bar 300 capacity",
        location: "1 Main St",
        regularsLove: "indie folk",
      },
      writer,
      Date.now() - 1000,
      3,
    );
    expect(pitch.headliner.name).toBe("Fixture Alpha");
    expect(steps.some((s) => s.kind === "quick")).toBe(true);
  });
});
