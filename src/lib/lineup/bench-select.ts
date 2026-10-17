import { filterActorFirstEntities } from "@/lib/agent/research/actor-screen";
import { filterVerifiedMusicianBench } from "@/lib/agent/research/musician-screen";
import type { ArtistResearchHints } from "@/lib/agent/research/types";
import type { QlooEntity } from "@/lib/qloo/types";
import {
  filterMusicArtists,
  headlinerGenreScore,
  isSamePerson,
  rankAlternateHeadliners,
  rankHeadlinerPool,
} from "./artist-filter";
import type { PopularityBand } from "./tiers";
import { widenPopularityBand } from "./tiers";

const BENCH_SCAN_CHUNK = 5;
const BENCH_MAX = 3;

function rankBenchPool(
  entities: QlooEntity[],
  genreTagIds: string[],
  band: PopularityBand | undefined,
  headliner: QlooEntity,
  exclude: QlooEntity[],
): QlooEntity[] {
  let benchBand: PopularityBand = band ?? { openerMax: 0.9 };
  let ranked = rankAlternateHeadliners(
    entities,
    genreTagIds,
    benchBand,
    headliner,
    exclude,
  );

  if (ranked.length === 0) {
    benchBand = widenPopularityBand(benchBand, 1);
    ranked = rankAlternateHeadliners(
      entities,
      genreTagIds,
      benchBand,
      headliner,
      exclude,
    );
  }

  if (ranked.length === 0 && (benchBand.seatCapacity ?? 999) <= 120) {
    benchBand = widenPopularityBand(benchBand, 2);
    ranked = rankAlternateHeadliners(
      entities,
      genreTagIds,
      benchBand,
      headliner,
      exclude,
      { relaxObscurityForTinyRoom: true, relaxBandCapForBench: true },
    );
  }

  if (
    ranked.length === 0 &&
    (benchBand.seatCapacity ?? 999) <= 300
  ) {
    ranked = rankAlternateHeadliners(
      entities,
      genreTagIds,
      benchBand,
      headliner,
      exclude,
      { relaxObscurityForTinyRoom: true, relaxBandCapForBench: true },
    );
  }

  if (ranked.length === 0) {
    ranked = rankHeadlinerPool(entities, genreTagIds, benchBand, exclude).filter(
      (entity) => !isSamePerson(entity, headliner),
    );
  }

  if (ranked.length === 0) {
    ranked = filterMusicArtists(entities, genreTagIds, exclude)
      .filter((entity) => !isSamePerson(entity, headliner))
      .sort(
        (a, b) =>
          headlinerGenreScore(b, genreTagIds) -
          headlinerGenreScore(a, genreTagIds),
      );
  }

  return ranked;
}

/**
 * Build bench rows from the headliner discovery pool. Scans past the top five
 * when Wikipedia musician screening clears nobody, and relaxes band/obscurity
 * when strict alternates would otherwise be empty.
 */
export async function selectBenchEntities(
  headlinerCandidates: QlooEntity[],
  genreTagIds: string[],
  band: PopularityBand | undefined,
  headliner: QlooEntity,
  exclude: QlooEntity[],
  hintsFor: (entity: QlooEntity) => ArtistResearchHints | undefined,
  maxCount = BENCH_MAX,
): Promise<QlooEntity[]> {
  const ranked = rankBenchPool(
    headlinerCandidates,
    genreTagIds,
    band,
    headliner,
    exclude,
  );
  if (ranked.length === 0) return [];

  const kept: QlooEntity[] = [];
  for (let i = 0; i < ranked.length && kept.length < maxCount; i += BENCH_SCAN_CHUNK) {
    const chunk = ranked.slice(i, i + BENCH_SCAN_CHUNK);
    let batch = await filterActorFirstEntities(chunk, hintsFor);
    batch = await filterVerifiedMusicianBench(batch, hintsFor);
    for (const entity of batch) {
      if (kept.length >= maxCount) break;
      if (exclude.some((e) => isSamePerson(e, entity))) continue;
      kept.push(entity);
    }
  }

  if (kept.length === 0) {
    for (const entity of ranked) {
      if (kept.length >= maxCount) break;
      if (exclude.some((e) => isSamePerson(e, entity))) continue;
      kept.push(entity);
    }
  }

  return kept.slice(0, maxCount);
}
