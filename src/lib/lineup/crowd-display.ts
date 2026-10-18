import type { CrowdDemographics } from "./pitch-analytics";

export function humanizeAgeBandKey(key: string): string {
  const younger = key.match(/(\d+)\s*_?\s*and\s*_?\s*younger/i);
  if (younger) return `${younger[1]} and younger`;
  const m = key.match(/(\d+)\s*_?\s*to\s*_?\s*(\d+)/i);
  if (m) return `${m[1]}–${m[2]}`;
  const single = key.match(/^(\d+)\s*_?\s*(\d+)$/);
  if (single) return `${single[1]}–${single[2]}`;
  return key.replace(/_/g, " ").trim();
}

export type CrowdAgeRow = { label: string; value: number };

export function crowdAgeRows(
  demo: CrowdDemographics | null | undefined,
): CrowdAgeRow[] {
  if (!demo?.age || typeof demo.age !== "object") return [];
  return Object.entries(demo.age)
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
    .map(([key, value]) => ({
      label: humanizeAgeBandKey(key),
      value: value as number,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/** Top over-indexed age band (Qloo skews are signed; only positive counts). */
export function crowdTopPositiveAgeRow(
  demo: CrowdDemographics | null | undefined,
): CrowdAgeRow | null {
  if (!demo?.age || typeof demo.age !== "object") return null;
  let best: CrowdAgeRow | null = null;
  for (const [key, value] of Object.entries(demo.age)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      continue;
    }
    const row = { label: humanizeAgeBandKey(key), value };
    if (!best || value > best.value) best = row;
  }
  return best;
}

export function crowdGenderLean(
  gender: CrowdDemographics["gender"],
): "female" | "male" | null {
  if (!gender) return null;
  const m = gender.male;
  const f = gender.female;
  const mOk = typeof m === "number" && Number.isFinite(m) && m > 0;
  const fOk = typeof f === "number" && Number.isFinite(f) && f > 0;
  if (!mOk && !fOk) return null;
  if (fOk && (!mOk || f > m)) return "female";
  if (mOk && (!fOk || m > f)) return "male";
  return null;
}

/** Plain-language crowd row for UI (no raw keys or index numbers). */
export function formatCrowdDisplay(
  demo: CrowdDemographics | null | undefined,
): string | null {
  if (!demo) return null;
  const parts: string[] = [];

  const topAge = crowdTopPositiveAgeRow(demo);
  if (topAge) {
    parts.push(`Skews ${topAge.label}`);
  }

  const lean = crowdGenderLean(demo.gender);
  if (lean === "female") parts.push("leans female");
  else if (lean === "male") parts.push("leans male");

  if (parts.length === 0) return null;
  return parts.join(" · ");
}
