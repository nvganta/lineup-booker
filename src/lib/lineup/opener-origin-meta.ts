import type { AgentSessionState, PitchPayload } from "@/lib/agent/types";

/** Per-act local origin flags from scout audit (same evidence as opener pick). */
export function buildOpenerOriginByActId(
  session: AgentSessionState,
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const row of session.openerAudit ?? []) {
    if (row.originMatch === true) map[row.id] = true;
  }
  for (const row of session.openerSwapQueue ?? []) {
    if (row.reason === "origin matches venue") map[row.id] = true;
  }
  if (session.openerEntity?.id && session.openerOriginMatchesCity === true) {
    map[session.openerEntity.id] = true;
  }
  return map;
}

export function openerOriginMatchesForAct(
  pitch: PitchPayload,
  actId: string | undefined,
): boolean {
  if (!actId) return false;
  if (pitch.meta?.openerOriginByActId?.[actId] === true) return true;
  if (
    pitch.meta?.openerOriginMatchesCity === true &&
    pitch.opener?.id === actId
  ) {
    return true;
  }
  return false;
}
