import { regularsStylesPhrase } from "@/lib/agent/pitch-catalog";
import type { AgentSessionState, StepKind, ToolVerdict } from "./types";

const SKIP_EVIDENCE_KEYS = new Set([
  "lat",
  "lon",
  "latitude",
  "longitude",
  "pin_lat",
  "pin_lon",
]);

const EVIDENCE_LABELS: Record<string, string> = {
  tags: "style tags matched",
  phrases: "phrases from your regulars",
  count: "areas ranked",
  candidates: "acts in the pool",
  local: "local signal",
  city: "city",
};

export function humanizeVerdictReason(reason: string): string {
  switch (reason) {
    case "partial_tag_coverage":
      return "Only some of your phrases mapped to live-music tags.";
    case "no_music_tags":
      return "No live-music tags matched.";
    case "already_scouted":
      return "Already scouted after headliner.";
    case "thin_demographics":
      return "Crowd age skew was too thin to claim.";
    case "opener_step_error":
      return "Opener lookup hit an error.";
    case "mood_line_replaced":
      return "";
    default:
      return reason.replace(/_/g, " ");
  }
}

export function formatStepEvidence(
  evidence?: Record<string, string | number | boolean>,
): string | undefined {
  if (!evidence) return undefined;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(evidence)) {
    if (SKIP_EVIDENCE_KEYS.has(k)) continue;
    const label = EVIDENCE_LABELS[k] ?? k.replace(/_/g, " ");
    if (typeof v === "number") {
      parts.push(`${label}: ${Number.isInteger(v) ? v : v.toFixed(2)}`);
    } else {
      parts.push(`${label}: ${v}`);
    }
  }
  return parts.length ? parts.join(" · ") : undefined;
}

export type StepNoteContext = {
  session: AgentSessionState;
  modelWhy: string;
  verdict: ToolVerdict;
  /** Headliner pool size, tag labels, street hint, etc. */
  headlinerCount?: number;
  tagLabels?: string[];
  streetHint?: string;
  widenLevel?: number;
  /** room_size_band reuses the plan kind. */
  sizing?: boolean;
};

/** Trim stray whitespace from Qloo tag names before display or copy. */
export function trimTagLabelForDisplay(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

/** "Indie - Folk", "folk indie", "Indie folk" → one readable "indie folk". */
export function readableTagLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const words = trimTagLabelForDisplay(raw)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}&' ]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) continue;
    const key = [...words].sort().join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(words.join(" ").trim());
  }
  return out;
}

export function bookerStepLabel(
  kind: StepKind,
  ctx: StepNoteContext,
): string {
  const { session, verdict } = ctx;
  const reasons = verdict.reasons;

  switch (kind) {
    case "venue": {
      if (verdict.level === "fail") return "Couldn't pin the room on the map.";
      const street =
        ctx.streetHint ??
        session.pin?.city ??
        "your address";
      return `Found your room near ${street}.`;
    }
    case "tags": {
      if (reasons.includes("refine_already_used"))
        return "Already tried that tag angle once.";
      if (reasons.includes("partial_tag_coverage"))
        return "Mapped some of your regulars' phrases to live-music tags.";
      if (verdict.level === "fail" || reasons.includes("no_tags"))
        return "Couldn't map those phrases to live-music tags.";
      const tagLabels = ctx.tagLabels?.length ? ctx.tagLabels : session.tagLabels;
      const styles = regularsStylesPhrase({ ...session, tagLabels });
      const deduped = readableTagLabels(tagLabels);
      if (!styles) return "Mapped your regulars to taste tags.";
      if (deduped.length > 1 && !styles.includes(" and "))
        return `Your regulars lean ${styles}, plus ${deduped.length - 1} related styles.`;
      return `Your regulars lean ${styles}.`;
    }
    case "headliner": {
      if (reasons.includes("unknown_tag_ids"))
        return "Sticking to the styles your regulars actually named.";
      if (verdict.level === "fail" || !session.headlinerEntity)
        return "No headliner cleared the room-size bar yet.";
      const n =
        ctx.headlinerCount ??
        session.headlinerPoolSize ??
        0;
      if (reasons.includes("too_big") || reasons.includes("oversized"))
        return `Too big for this room — looking a size down.`;
      if ((ctx.widenLevel ?? session.widenLevel) > 0)
        return "Local signal was thin — widened the headliner search.";
      const rank = session.headlinerRankInPool;
      const pool = session.headlinerPoolSize ?? n;
      if (rank != null && pool > 0) {
        if (rank === 1) {
          return `${session.headlinerEntity.name} leads ${pool} acts that fit your room.`;
        }
        return `Picked #${rank} of ${pool} acts for room fit.`;
      }
      return n > 0
        ? `${session.headlinerEntity.name} leads ${n} acts that fit your room.`
        : `Locked ${session.headlinerEntity.name} for the poster.`;
    }
    case "opener":
      if (session.openerEntity) {
        const local = session.openerOriginMatchesCity === true;
        return local
          ? `Local opener: ${session.openerEntity.name}.`
          : `Opener: ${session.openerEntity.name}.`;
      }
      if (verdict.level === "weak")
        return "Opener pool was thin — headliner still holds.";
      return "Still hunting an opener.";
    case "neighborhoods": {
      const count = session.neighborhoods.length;
      if (count >= 2)
        return `Ranked ${count} neighborhoods to poster first.`;
      return "Fan heat map was sparse nearby.";
    }
    case "crowd":
      if (session.crowdDemographics)
        return "Age skew checked against nearby listeners.";
      return "Crowd age data wasn't clear enough to claim.";
    case "research":
      return ctx.modelWhy || "Read artist bios from public sources.";
    case "pitch":
      if (reasons.includes("mood_line_replaced"))
        return "Pitch locked — used a plain room line.";
      if (verdict.level === "good")
        return "Pitch locked for the room.";
      if (reasons.includes("no_headliner")) return "No headliner yet, so no pitch to write.";
      return "Pitch didn't pass the fact check — trying another finish.";
    case "plan":
      if (ctx.sizing) {
        if (verdict.level !== "good") return "Kept the act size we already had.";
        return (ctx.widenLevel ?? 0) > 0
          ? "Opened the search to slightly bigger acts."
          : "Matched act size to your room.";
      }
      return "Scouting one night for this room.";
    case "retry":
      return "Switching to Quick mode.";
    case "quick":
      return "Running the standard lineup (Quick mode).";
    default:
      return "Scouting…";
  }
}
