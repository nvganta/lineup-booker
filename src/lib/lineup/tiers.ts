export type PopularityBand = {
  headlinerMin?: number;
  headlinerMax?: number;
  openerMax: number;
};

export function popularityBandFromConcept(concept: string): PopularityBand {
  const match = concept.match(/(\d{2,4})\s*(-?\s*)?(seats?|capacity|cap\b)/i);
  if (!match) {
    return { headlinerMin: 0.7, headlinerMax: 0.94, openerMax: 0.9 };
  }
  const seats = Number(match[1]);
  if (seats <= 120) {
    return { headlinerMin: 0.55, headlinerMax: 0.88, openerMax: 0.72 };
  }
  if (seats < 300) {
    return { headlinerMin: 0.6, headlinerMax: 0.85, openerMax: 0.82 };
  }
  if (seats >= 400) {
    return { headlinerMin: 0.88, openerMax: 0.92 };
  }
  return { headlinerMin: 0.7, headlinerMax: 0.94, openerMax: 0.9 };
}

export function tierLabel(rank: number, tier: "headliner" | "opener"): string {
  if (tier === "headliner") {
    return rank === 1 ? "Top local match" : `#${rank} in your crowd profile`;
  }
  return rank === 1 ? "Best support fit" : `#${rank} support option`;
}
