import type { AgentSessionState } from "../types";
import type { ArtistBackground, ArtistResearchInput } from "./types";
import { RESEARCH_TOTAL_MS } from "./types";
import { researchOneArtist } from "./research-artists";

function researchKey(input: ArtistResearchInput): string {
  return input.id ?? input.name;
}

export function scheduleArtistResearch(
  session: AgentSessionState,
  input: ArtistResearchInput,
): void {
  if (!session.artistResearchPending) session.artistResearchPending = new Map();
  const key = researchKey(input);
  if (session.artistResearchPending.has(key)) return;
  if (session.artistBackgrounds?.[key]) return;

  const promise = researchOneArtist(input);
  session.artistResearchPending.set(key, {
    key,
    name: input.name,
    promise,
  });
}

export async function flushArtistResearch(
  session: AgentSessionState,
  totalBudgetMs: number = RESEARCH_TOTAL_MS,
): Promise<Record<string, ArtistBackground>> {
  if (!session.artistBackgrounds) session.artistBackgrounds = {};
  const pending = session.artistResearchPending;
  if (!pending?.size) return session.artistBackgrounds;

  const list = [...pending.values()];
  const deadline = Date.now() + totalBudgetMs;

  await Promise.all(
    list.map(async (p) => {
      const msLeft = Math.max(0, deadline - Date.now());
      if (msLeft === 0) return;
      const bg = await Promise.race([
        p.promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), msLeft)),
      ]);
      if (bg) session.artistBackgrounds![p.key] = bg;
      pending.delete(p.key);
    }),
  );
  pending.clear();

  return session.artistBackgrounds;
}

export function researchNamesForLog(session: AgentSessionState): string[] {
  const names = new Set<string>();
  for (const bg of Object.values(session.artistBackgrounds ?? {})) {
    void bg;
  }
  if (session.headlinerEntity?.name) names.add(session.headlinerEntity.name);
  if (session.openerEntity?.name) names.add(session.openerEntity.name);
  for (const p of session.artistResearchPending?.values() ?? []) {
    names.add(p.name);
  }
  return [...names];
}

export function researchSourceFootnotes(
  backgrounds: Record<string, ArtistBackground>,
): Record<string, string> {
  const footnotes: Record<string, string> = {};
  for (const [id, bg] of Object.entries(backgrounds)) {
    footnotes[`research:${id}`] = `${bg.sourceName}: ${bg.sourceUrl}`;
  }
  return footnotes;
}
