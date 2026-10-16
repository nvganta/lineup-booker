import type { ToolVerdict } from "./types";

export type RefineStrategy =
  | "union_tags"
  | "adjacent_genres"
  | "split_phrases"
  | "widen_band_1"
  | "widen_band_2"
  | "opener_next_batch"
  | "opener_adjacent_genres"
  | "neighborhood_tag_heatmap"
  | "geocode_next_strategy";

export function canUseRefine(
  used: Set<string>,
  strategy: RefineStrategy,
): boolean {
  return !used.has(strategy);
}

export function markRefineUsed(
  used: Set<string>,
  strategy: RefineStrategy,
): boolean {
  if (used.has(strategy)) return false;
  used.add(strategy);
  return true;
}

/** Returns a fail verdict when the strategy was already used; otherwise marks it used. */
export function consumeRefine(
  used: Set<string>,
  strategy: RefineStrategy,
): ToolVerdict | null {
  if (!canUseRefine(used, strategy)) {
    return {
      level: "fail",
      reasons: ["refine_already_used"],
      evidence: { strategy },
    };
  }
  markRefineUsed(used, strategy);
  return null;
}
