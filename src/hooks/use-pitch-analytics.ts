"use client";

import type { PitchPayload } from "@/lib/agent/types";
import type { PitchAnalytics } from "@/lib/lineup/pitch-analytics";
import type { LineupResult } from "@/lib/lineup/build-lineup";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { SAMPLE_RUNS } from "@/lib/sample-runs";
import { cityFromRequest } from "@/lib/stored-lineups";
import { useEffect, useMemo, useState } from "react";

export type AnalyticsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: PitchAnalytics }
  | { status: "error" };

function countryFromLocation(location: string): string {
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (/^(BC|ON|AB|QC|MB|SK|NS|NB|NL|PE|YT|NT|NU)$/i.test(last)) {
    return "Canada";
  }
  if (last.length === 2 && parts.length >= 2) {
    return "United States";
  }
  return last || "Canada";
}

export function analyticsInputFromPitch(pitch: PitchPayload): {
  cityQuery: string;
  countryQuery: string;
  cityLabel: string;
  concept: string;
  regularsLove: string;
  musicTagIds: string[];
  headliner: { id: string; name: string };
  opener: { id: string; name: string } | null;
  bench: Array<{ id: string; name: string }>;
  openerOriginMatchesCity?: boolean;
  headlinerPoolSize?: number;
  headlinerRankInPool?: number;
  headlinerPopularity?: number;
  openerPopularity?: number;
  tagLabels?: string[];
} | null {
  const cityQuery = pitch.meta?.cityQuery ?? pitch.meta?.cityLabel;
  if (!cityQuery) return null;
  return {
    cityQuery,
    countryQuery: pitch.meta?.countryQuery ?? "Canada",
    cityLabel: pitch.meta?.cityLabel ?? cityQuery,
    concept: pitch.meta?.concept ?? "",
    regularsLove: pitch.meta?.regularsLove ?? "",
    musicTagIds: pitch.meta?.musicTagIds ?? [],
    headliner: { id: pitch.headliner.id, name: pitch.headliner.name },
    opener: pitch.opener
      ? { id: pitch.opener.id, name: pitch.opener.name }
      : null,
    bench: pitch.alternates.map((a) => ({ id: a.id, name: a.name })),
    openerOriginMatchesCity:
      pitch.opener?.id && pitch.meta?.openerOriginByActId?.[pitch.opener.id]
        ? true
        : pitch.meta?.openerOriginMatchesCity,
    headlinerPoolSize: pitch.meta?.headlinerPoolSize,
    headlinerRankInPool: pitch.meta?.headlinerRankInPool,
    headlinerPopularity: pitch.meta?.headlinerPopularity,
    openerPopularity: pitch.meta?.openerPopularity,
    tagLabels: pitch.meta?.tagLabels,
  };
}

export function analyticsInputFromLineup(
  lineup: LineupResult,
  request: LineupRequest,
): NonNullable<ReturnType<typeof analyticsInputFromPitch>> {
  const cityLabel = lineup.venue?.city ?? cityFromRequest(request);
  return {
    cityQuery: cityLabel,
    countryQuery: countryFromLocation(request.location),
    cityLabel,
    concept: request.concept,
    regularsLove: request.regularsLove,
    musicTagIds: [],
    headliner: { id: lineup.headliner.id, name: lineup.headliner.name },
    opener: lineup.opener
      ? { id: lineup.opener.id, name: lineup.opener.name }
      : null,
    bench: lineup.alternates.map((a) => ({ id: a.id, name: a.name })),
  };
}

async function fetchAnalytics(
  body: NonNullable<ReturnType<typeof analyticsInputFromPitch>>,
): Promise<PitchAnalytics> {
  const res = await fetch("/api/pitch-analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("analytics failed");
  const json = (await res.json()) as { analytics: PitchAnalytics };
  return json.analytics;
}

/**
 * Analytics already fetched this session, keyed by input. Each fetch costs
 * several Qloo calls, and the poster remounts whenever you switch lineups.
 */
const analyticsMemo = new Map<string, PitchAnalytics>();
for (const run of Object.values(SAMPLE_RUNS)) {
  const input = analyticsInputFromPitch(run.pitch);
  if (input) analyticsMemo.set(JSON.stringify(input), run.analytics);
}

export function usePitchAnalytics(
  input: ReturnType<typeof analyticsInputFromPitch>,
  refreshKey = 0,
): AnalyticsState {
  const inputKey = useMemo(
    () => (input ? JSON.stringify({ ...input, refreshKey }) : ""),
    [input, refreshKey],
  );
  const memoKey = useMemo(() => (input ? JSON.stringify(input) : ""), [input]);
  const [state, setState] = useState<AnalyticsState>({ status: "idle" });

  useEffect(() => {
    if (!inputKey || analyticsMemo.has(memoKey)) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setState({ status: "loading" });
    });
    fetchAnalytics(
      (() => {
        const parsed = JSON.parse(inputKey) as NonNullable<typeof input> & {
          refreshKey?: number;
        };
        delete parsed.refreshKey;
        return parsed;
      })(),
    )
      .then((data) => {
        analyticsMemo.set(memoKey, data);
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [inputKey, memoKey]);

  if (!input) return { status: "idle" };
  const remembered = analyticsMemo.get(memoKey);
  return remembered ? { status: "ready", data: remembered } : state;
}
