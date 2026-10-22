import type { DraftIdea } from "./drafted-copy";
import type { TasteCountRow, TasteKind } from "./place-insights";

/** One thing to put on special, with the count behind it in plain words. */
export type SellCard = {
  label: string;
  kind: TasteKind;
  fans: number;
  city: number;
  /** "2×", "+5" or "fans only": how much the fans' spots over-index. */
  lift: string;
  line: string;
  idea: DraftIdea | null;
  /** The special to suggest when the agent drafted none for this row. */
  fallback: string;
};

export type SellCardsInput = {
  rows: TasteCountRow[];
  ideas: DraftIdea[];
  headliner: string;
  cityLabel: string;
  fanSample: number;
  citySample: number;
};

export function liftLabel(fans: number, city: number): string {
  if (city === 0) return "fans only";
  const ratio = fans / city;
  if (ratio >= 1.5) {
    const rounded = Math.round(ratio * 2) / 2;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}×`;
  }
  return `+${fans - city}`;
}

/** Venue types ("Pub", "Brewery") are what a place is, not what it pours. */
const VENUE_TYPE = /pub|brew|bar|distill|speakeasy|tap ?room|diner|bakery|deli|truck/i;

function verb(kind: TasteKind, label: string): string {
  const l = label.toLowerCase();
  if (VENUE_TYPE.test(l)) return `are ${/^[aeiou]/.test(l) ? "an" : "a"} ${l}`;
  switch (kind) {
    case "late":
      return "are open late";
    case "drink":
      return `pour ${l}`;
    case "diet":
      return `offer ${l}`;
    case "food":
      return `serve ${l}`;
  }
}

export function sellCards({
  rows,
  ideas,
  headliner,
  cityLabel,
  fanSample,
  citySample,
}: SellCardsInput): { top: SellCard[]; rest: TasteCountRow[] } {
  const ups = rows
    .filter((r) => r.fans > r.city)
    .sort((a, b) => b.fans - b.city - (a.fans - a.city) || b.fans - a.fans);
  const top = ups.slice(0, 3).map((r) => ({
    fallback: VENUE_TYPE.test(r.label)
      ? `Run a ${r.label.toLowerCase()} night: the pours and the prices.`
      : `Put ${r.label.toLowerCase()} on special that night.`,
    label: r.label,
    kind: r.kind,
    fans: r.fans,
    city: r.city,
    lift: liftLabel(r.fans, r.city),
    line: `${r.fans} of ${headliner} fans' top ${fanSample} spots ${verb(r.kind, r.label)}. ${r.city} of ${cityLabel}'s top ${citySample} do.`,
    idea: ideas.find((i) => i.basis === r.label) ?? null,
  }));
  const picked = new Set(top.map((t) => t.label));
  return { top, rest: rows.filter((r) => !picked.has(r.label)) };
}
