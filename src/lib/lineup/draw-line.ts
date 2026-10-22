import { ordinal } from "@/lib/copy/ordinal";

export type DrawTier = "rising" | "mid" | "big" | "headline";

/** How big an act is, in words an owner uses, from Qloo's 0..1 popularity. */
export type DrawLine = {
  tier: DrawTier;
  label: string;
  line: string;
  /** 0..100, for the meter. */
  percentile: number;
};

const TIER_LABEL: Record<DrawTier, string> = {
  rising: "Rising act",
  mid: "Mid-size draw",
  big: "Big draw",
  headline: "Headline draw",
};

export function drawTier(popularity: number): DrawTier {
  if (popularity < 0.6) return "rising";
  if (popularity < 0.8) return "mid";
  if (popularity < 0.92) return "big";
  return "headline";
}

function roomClause(tier: DrawTier, capacity: number | undefined): string {
  const room = capacity ? `a ${capacity}-cap room` : "a small room";
  switch (tier) {
    case "rising":
      return `Easier to book; needs promotion to fill ${room}.`;
    case "mid":
      return `Sized for ${room}.`;
    case "big":
      return `Likely fills ${room} on name alone; expect a higher fee.`;
    case "headline":
      return `Probably outgrows ${room}.`;
  }
}

export function drawLine(
  popularity: number | undefined,
  capacity: number | undefined,
): DrawLine | null {
  if (popularity == null || !Number.isFinite(popularity)) return null;
  const tier = drawTier(popularity);
  const percentile = Math.round(Math.max(0, Math.min(1, popularity)) * 100);
  return {
    tier,
    label: TIER_LABEL[tier],
    percentile,
    line: `${ordinal(percentile)} percentile for listener reach on Qloo. ${roomClause(tier, capacity)}`,
  };
}
