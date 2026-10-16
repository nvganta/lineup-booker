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

export function formatStepEvidence(
  evidence?: Record<string, string | number | boolean>,
): string | undefined {
  if (!evidence) return undefined;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(evidence)) {
    if (SKIP_EVIDENCE_KEYS.has(k)) continue;
    if (typeof v === "number") {
      parts.push(`${k} ${Number.isInteger(v) ? v : v.toFixed(2)}`);
    } else {
      parts.push(`${k} ${v}`);
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

/** "Indie - Folk", "folk indie", "Indie folk" → one readable "indie folk". */
export function readableTagLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const words = raw
      .toLowerCase()
      .replace(/[^\p{L}\p{N}&' ]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) continue;
    const key = [...words].sort().join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(words.join(" "));
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
      const n = ctx.headlinerCount ?? 0;
      if (reasons.includes("too_big") || reasons.includes("oversized"))
        return `Too big for this room — looking a size down.`;
      return n > 0
        ? `${session.headlinerEntity.name} leads ${n} acts that fit your room.`
        : `Locked ${session.headlinerEntity.name} for the poster.`;
    }
    case "opener":
      if (session.openerEntity)
        return `Local opener: ${session.openerEntity.name}.`;
      if (verdict.level === "weak")
        return "Opener pool was thin — headliner still holds.";
      return "Still hunting a local opener.";
    case "neighborhoods": {
      const count = session.neighborhoods.length;
      if (count >= 2)
        return `Ranked ${count} neighborhoods to poster first.`;
      return "Fan heat map was sparse nearby.";
    }
    case "crowd":
      if (session.crowdLine) return "Age skew checked against nearby listeners.";
      return "Crowd age data wasn't clear enough to claim.";
    case "research":
      return ctx.modelWhy || "Read artist bios from public sources.";
    case "pitch":
      if (verdict.level === "good") return "Pitch locked for the room.";
      if (reasons.includes("no_headliner")) return "No headliner yet, so no pitch to write.";
      if (reasons.includes("mood_line_replaced"))
        return "Pitch locked; swapped the opening line for one that sticks to the facts.";
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
