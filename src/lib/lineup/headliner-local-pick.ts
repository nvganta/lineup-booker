import { hintsFromQlooEntity } from "@/lib/agent/research/qloo-hints";
import type { QlooEntity } from "@/lib/qloo/types";
import { lookupArtistOrigin } from "./artist-origin-lookup";
import { headlinerPickOrder, pickHeadliner } from "./artist-filter";
import { artistOriginMatchesVenue, type VenuePin } from "./geography";
import type { PopularityBand } from "./tiers";

const LOCAL_BATCH_SIZE = 4;
const LOCAL_TOTAL_BUDGET_MS = 2_500;
const LOCAL_PER_CANDIDATE_MS = 1_200;

/**
 * Same ranked pool as pickHeadliner; for rooms ≤300 seats prefer a local origin.
 */
export async function pickHeadlinerForVenue(
  entities: QlooEntity[],
  genreTagIds: string[],
  band: PopularityBand | undefined,
  pin: VenuePin | undefined,
  exclude: QlooEntity[] = [],
): Promise<QlooEntity | undefined> {
  const fallback = pickHeadliner(entities, genreTagIds, band, exclude);
  if (
    !fallback ||
    !pin ||
    band?.seatCapacity === undefined ||
    band.seatCapacity > 300
  ) {
    return fallback;
  }

  const ordered = headlinerPickOrder(entities, genreTagIds, band, exclude);
  const deadline = Date.now() + LOCAL_TOTAL_BUDGET_MS;

  for (let i = 0; i < ordered.length && i < 16; i += LOCAL_BATCH_SIZE) {
    if (Date.now() >= deadline) break;
    const batch = ordered.slice(i, i + LOCAL_BATCH_SIZE);
    const batchBudget = Math.min(
      LOCAL_PER_CANDIDATE_MS,
      Math.max(400, deadline - Date.now()),
    );
    const origins = await Promise.all(
      batch.map((entity) =>
        lookupArtistOrigin(
          entity.name,
          hintsFromQlooEntity(entity),
          batchBudget,
        ),
      ),
    );
    for (let j = 0; j < batch.length; j++) {
      if (artistOriginMatchesVenue(origins[j], pin)) {
        return batch[j];
      }
    }
  }
  return fallback;
}
