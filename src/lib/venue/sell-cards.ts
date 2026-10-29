import type { DraftIdea } from "./drafted-copy";
import type { TasteCountRow, TasteKind } from "./place-insights";

/** One thing to put on special, with the share behind it in plain words. */
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

/** "cocktail bar" → "cocktail bars", "brewery" → "breweries". */
function plural(l: string): string {
  if (/[^aeiou]y$/.test(l)) return `${l.slice(0, -1)}ies`;
  if (/(s|x|ch|sh)$/.test(l)) return `${l}es`;
  return `${l}s`;
}

/** What the places do, and the short form for the city's side of the sentence. */
function verb(kind: TasteKind, label: string): { verb: string; again: string } {
  const l = label.toLowerCase();
  if (VENUE_TYPE.test(l)) return { verb: `are ${plural(l)}`, again: "are" };
  switch (kind) {
    case "late":
      return { verb: "stay open late", again: "do" };
    case "drink":
      return { verb: `pour ${l}`, again: "do" };
    case "diet":
      return { verb: `offer ${l}`, again: "do" };
    case "food":
      return { verb: `serve ${l}`, again: "do" };
  }
}

/** Share of a sample, as a whole percent. */
export function share(n: number, of: number): number {
  return of > 0 ? Math.round((n / of) * 100) : 0;
}

/**
 * The counts are places, not people: "13 of 15" read as thirteen fans. Say
 * it as a share of the places the fans go most, against the city's.
 */
export function sellLine(
  r: Pick<TasteCountRow, "label" | "kind" | "fans" | "city">,
  headliner: string,
  cityLabel: string,
  fanSample: number,
  citySample: number,
): string {
  const v = verb(r.kind, r.label);
  const fanPct = share(r.fans, fanSample);
  const cityPct = share(r.city, citySample);
  const fanSide = `${fanPct}% of the places ${headliner} fans go most ${v.verb}.`;
  const citySide =
    cityPct === 0
      ? `Almost none of ${cityLabel}'s top spots ${v.again}.`
      : `${cityPct * 2 <= fanPct ? "Only " : ""}${cityPct}% of ${cityLabel}'s top spots ${v.again}.`;
  return `${fanSide} ${citySide}`;
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
    line: sellLine(r, headliner, cityLabel, fanSample, citySample),
    idea: ideas.find((i) => i.basis === r.label) ?? null,
  }));
  const picked = new Set(top.map((t) => t.label));
  return { top, rest: rows.filter((r) => !picked.has(r.label)) };
}
