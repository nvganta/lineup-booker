import type { StepDataPart } from "./types";

/** User-facing step body only — never model tool-planning `why` text. */
export function stepBodyForDisplay(step: StepDataPart): string | null {
  if (step.kind === "pitch" || step.kind === "quick" || step.kind === "retry") {
    return step.detail?.trim() || null;
  }
  return step.detail?.trim() || null;
}
