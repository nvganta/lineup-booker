import type { PitchAnalytics } from "./pitch-analytics";

/** Merge analytics why lines keyed by act id (never by slot). */
export function mergeWhyLinesByActId(
  prev: Record<string, string>,
  analytics: PitchAnalytics | null | undefined,
): Record<string, string> {
  if (!analytics?.acts?.length) return prev;
  const next = { ...prev };
  for (const act of analytics.acts) {
    if (act.whyLine?.trim()) {
      next[act.id] = act.whyLine.trim();
    }
  }
  return next;
}

export function whyLineForAct(
  cache: Record<string, string>,
  actId: string | undefined,
): string | null {
  if (!actId) return null;
  return cache[actId]?.trim() || null;
}

const posterWhyCaches = new Map<string, Record<string, string>>();

export function posterRunWhyKey(pitch: {
  headliner: { id: string };
  address: string;
}): string {
  return `${pitch.headliner.id}:${pitch.address.trim()}`;
}

/** Persistent per-poster why lines (keyed by act id, survives opener swaps). */
export function whyCacheForPosterRun(
  runKey: string,
  analytics: PitchAnalytics | null | undefined,
): Record<string, string> {
  const prev = posterWhyCaches.get(runKey) ?? {};
  if (!analytics) return prev;
  const next = mergeWhyLinesByActId(prev, analytics);
  posterWhyCaches.set(runKey, next);
  return next;
}
