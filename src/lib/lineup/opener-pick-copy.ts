import type { AgentSessionState } from "@/lib/agent/types";

export function openerPickLineFromEvidence(opts: {
  name: string;
  headlinerName: string;
  originMatch?: boolean;
  popularity?: number;
}): string {
  const { name, headlinerName, originMatch, popularity } = opts;
  if (originMatch) {
    return `${name} is a local act in the same lane, an easy warm-up for ${headlinerName}.`;
  }
  if (
    typeof popularity === "number" &&
    Number.isFinite(popularity)
  ) {
    return `${name} fits the room's opener draw — below ${headlinerName} in listener reach.`;
  }
  return `${name} fits the room's opener slot in the same lane as ${headlinerName}.`;
}

export function buildOpenerPickLinesByActId(
  session: AgentSessionState,
): Record<string, string> {
  const lines: Record<string, string> = {};
  const headlinerName = session.headlinerEntity?.name ?? "the headliner";
  const auditById = new Map(
    (session.openerAudit ?? []).map((a) => [a.id, a]),
  );
  const actIds = new Set<string>();
  if (session.openerEntity?.id) actIds.add(session.openerEntity.id);
  for (const row of session.openerSwapQueue ?? []) actIds.add(row.id);

  for (const id of actIds) {
    const audit = auditById.get(id);
    const queue = session.openerSwapQueue?.find((q) => q.id === id);
    const name =
      audit?.name ??
      queue?.name ??
      (session.openerEntity?.id === id ? session.openerEntity.name : id);
    const originMatch =
      audit?.originMatch === true || queue?.reason === "origin matches venue";
    lines[id] = openerPickLineFromEvidence({
      name,
      headlinerName,
      originMatch,
      popularity: audit?.popularity ?? queue?.popularity,
    });
  }
  return lines;
}

export function openerPickLineForSession(
  session: AgentSessionState,
): string | null {
  const opener = session.openerEntity;
  if (!opener) return null;
  const map = buildOpenerPickLinesByActId(session);
  return map[opener.id] ?? null;
}
