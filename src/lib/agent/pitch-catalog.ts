import { readableTagLabels } from "@/lib/agent/step-copy";
import { openerPickLineForSession } from "@/lib/lineup/opener-pick-copy";
import type { AgentSessionState } from "./types";

export type PitchWhyCatalog = {
  headlinerWhy: Record<string, string>;
  openerWhy: Record<string, string>;
  headlinerSlotIds: string[];
  openerSlotIds: string[];
};

/** "indie rock and dream pop" — at most two styles so the line stays short. */
export function regularsStylesPhrase(session: AgentSessionState): string | null {
  // Skip a style whose words are mostly covered ("folk" after "indie folk").
  const picked: string[] = [];
  for (const raw of readableTagLabels(session.tagLabels ?? [])) {
    const tag = raw
      .trim()
      .replace(/\bsinger songwriters?\b/, "singer-songwriter")
      .replace(/\bpost punk\b/, "post-punk")
      .replace(/\bhip hop\b/, "hip-hop")
      .replace(/\bindie(?=[a-z])/g, "indie ")
      .trim();
    const words = tag.split(" ").filter((w) => w !== "and" && w !== "&");
    const covered = picked.some((p) => {
      const have = p.split(" ");
      // Mostly the same words reads as a repeat ("folk indie pop" after "indie folk").
      return words.filter((w) => have.includes(w)).length * 2 >= words.length;
    });
    if (!covered) picked.push(tag);
    if (picked.length === 2) break;
  }
  if (picked.length === 0) return null;
  return picked.join(" and ");
}

function withArticle(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? `An ${phrase}` : `A ${phrase}`;
}

/** Headliner line when no slot was chosen (salvage / Quick mode). */
export function headlinerFitLine(session: AgentSessionState): string {
  const name = session.headlinerEntity!.name;
  const styles = regularsStylesPhrase(session);
  return styles
    ? `${name} is the right size for this room and plays the ${styles} your regulars come in for.`
    : `${name} is the right size for this room and in the lane your regulars love.`;
}

/** Opener line when no slot was chosen (salvage / Quick mode). */
export function openerLocalLine(session: AgentSessionState): string | null {
  return openerPickLineForSession(session);
}

/** Mood line when the model didn't write one. */
export function fallbackMoodLine(session: AgentSessionState): string {
  const styles = regularsStylesPhrase(session);
  return styles
    ? `${withArticle(styles)} night sized for your room.`
    : "A live night sized for your room.";
}

// Slot copy is written like a booker's note, not a report. The artist bio is
// not a slot: the card already prints it under the name.
export function buildPitchWhyCatalog(
  session: AgentSessionState,
): PitchWhyCatalog {
  const headliner = session.headlinerEntity!;
  const styles = regularsStylesPhrase(session);

  const headlinerWhy: Record<string, string> = {
    room_and_tags: headlinerFitLine(session),
    genre_match: styles
      ? `${headliner.name} sits right in the ${styles} your regulars already love.`
      : `${headliner.name} sits right in the lane your regulars already love.`,
  };

  const areas = session.neighborhoods.map((n) => n.name);
  if (areas.length >= 2) {
    headlinerWhy.local_heat = `${headliner.name}'s listeners are thickest around ${areas[0]} and ${areas[1]}.`;
  } else if (areas.length === 1) {
    headlinerWhy.local_heat = `${headliner.name}'s listeners are thickest around ${areas[0]}.`;
  }

  const openerWhy: Record<string, string> = {
    none: "No local opener stood out this time.",
  };

  const opener = session.openerEntity;
  if (opener) {
    openerWhy.local_support = openerLocalLine(session)!;
    openerWhy.overlap = `${opener.name} shares taste overlap with ${headliner.name}'s fans in this room's lane.`;
  }

  return {
    headlinerWhy,
    openerWhy,
    headlinerSlotIds: Object.keys(headlinerWhy),
    openerSlotIds: Object.keys(openerWhy),
  };
}

export function assemblePitchWhyLines(
  catalog: PitchWhyCatalog,
  headlinerWhySlot: string,
  openerWhySlot: string,
): { headlinerWhy: string; openerWhy: string } | null {
  const headlinerWhy = catalog.headlinerWhy[headlinerWhySlot];
  const openerWhy = catalog.openerWhy[openerWhySlot];
  if (!headlinerWhy || !openerWhy) return null;
  return { headlinerWhy, openerWhy };
}
