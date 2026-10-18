import type { CrowdDemographics } from "./pitch-analytics";
import {
  crowdAgeRows,
  crowdGenderLean,
  type CrowdAgeRow,
} from "./crowd-display";

/** Format a Qloo relative skew (signed index, not a percentage). */
export function formatSkewIndex(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded =
    Math.abs(value) >= 10
      ? Math.round(value)
      : Math.round(value * 100) / 100;
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

export function crowdSkewMaxAbs(rows: CrowdAgeRow[]): number {
  if (!rows.length) return 1;
  return Math.max(1, ...rows.map((r) => Math.abs(r.value)));
}

export function genderSkewSummary(
  gender: CrowdDemographics["gender"],
): string | null {
  const lean = crowdGenderLean(gender);
  if (!lean) return "no clear gender skew";
  const value = lean === "female" ? gender?.female : gender?.male;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "no clear gender skew";
  }
  return `${formatSkewIndex(value)} ${lean} skew`;
}

export function crowdAgeSkewRows(
  demo: CrowdDemographics | null | undefined,
): CrowdAgeRow[] {
  return crowdAgeRows(demo);
}
