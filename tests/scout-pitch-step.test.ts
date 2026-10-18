import { describe, expect, it } from "vitest";
import { pitchLockedStepCount } from "@/lib/agent/scout-steps-display";
import type { AgentFinishSummary, StepDataPart } from "@/lib/agent/types";

/** Typical successful run: one pitch step from compose_pitch (running + done share an id). */
const recordedPitchSequence: StepDataPart[] = [
  {
    id: "pitch-1",
    kind: "pitch",
    status: "running",
    label: "Writing the pitch for the room.",
    why: "Final pitch copy.",
  },
  {
    id: "pitch-1",
    kind: "pitch",
    status: "done",
    label: "Pitch locked for the room.",
    why: "Final pitch copy.",
  },
];

const summary: AgentFinishSummary = {
  elapsedSec: 42,
  qlooLookups: 12,
  retries: 0,
};

describe("scout pitch step display", () => {
  it("shows Pitch locked exactly once after a recorded stream merge", () => {
    expect(pitchLockedStepCount(recordedPitchSequence, summary)).toBe(1);
  });
});
