import type { PitchPayload } from "@/lib/agent/types";
import type { PlainResult } from "@/lib/compare/without-qloo";
import type { PitchAnalytics } from "@/lib/lineup/pitch-analytics";

/**
 * A real run saved from the live app, so the example rooms open instantly
 * and cost no Qloo calls. "Suggest a lineup" still scouts live.
 *
 * The runs hold Qloo response data, which the hackathon terms keep out of
 * public repos, so they live in the SAMPLE_RUNS_JSON server env var (keyed by
 * address) and reach the page through /api/sample-runs.
 */
export type SampleRun = {
  savedAt: string;
  pitch: PitchPayload;
  venue: { lat: number; lon: number };
  plain: PlainResult;
  /** What /api/pitch-analytics returned for this pitch. */
  analytics: PitchAnalytics;
};

export type SampleRuns = Record<string, SampleRun>;

/** Raw JSON or base64 JSON; base64 survives env-file quoting (the copy has apostrophes). */
export function parseSampleRuns(raw: string | undefined): SampleRuns {
  const value = raw?.trim();
  if (!value) return {};
  try {
    const json = value.startsWith("{") ? value : Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, SampleRun>).filter(
        ([, run]) => run?.pitch?.headliner?.id && run.plain?.answer && run.analytics?.acts,
      ),
    );
  } catch {
    return {};
  }
}
