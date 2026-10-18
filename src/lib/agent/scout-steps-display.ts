import type { AgentFinishSummary, StepDataPart } from "./types";

/** Same filtering as AgentScoutStream (for tests and single source of truth). */
export function visibleScoutSteps(
  steps: StepDataPart[],
  done: boolean,
): StepDataPart[] {
  const filtered = steps.filter(
    (s) =>
      s.kind !== "plan" &&
      !(s.kind === "pitch" && s.status === "fail") &&
      (s.status !== "running" || !done),
  );
  const quickSteps = filtered.filter((s) => s.kind === "quick");
  const pitchSteps = filtered.filter((s) => s.kind === "pitch");
  let out = filtered;
  if (quickSteps.length > 1) {
    const lastQuick = quickSteps[quickSteps.length - 1]!;
    out = out.filter((s) => s.kind !== "quick" || s.id === lastQuick.id);
  }
  if (pitchSteps.length > 1) {
    const lastPitch = pitchSteps[pitchSteps.length - 1]!;
    out = out.filter((s) => s.kind !== "pitch" || s.id === lastPitch.id);
  }
  return out;
}

export function countStepLabels(
  steps: StepDataPart[],
  label: string,
  done = true,
): number {
  return visibleScoutSteps(steps, done).filter((s) => s.label === label).length;
}

export function pitchLockedStepCount(
  steps: StepDataPart[],
  summary?: AgentFinishSummary,
): number {
  return countStepLabels(steps, "Pitch locked for the room.", Boolean(summary));
}
