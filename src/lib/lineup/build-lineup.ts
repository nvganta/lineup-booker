import { filterActorFirstEntities } from "@/lib/agent/research/actor-screen";
import { filterVerifiedMusicianBench } from "@/lib/agent/research/musician-screen";
import { hintsFromQlooEntity } from "@/lib/agent/research/qloo-hints";
import type { QlooEntity } from "@/lib/qloo/types";
import {
  isSamePerson,
  pickHeadliner,
  rankAlternateHeadliners,
} from "./artist-filter";
import { openerPopularityMax, pickOpener } from "./opener-select";
import {
  discoverHeadliners,
  discoverOpeners,
  fetchArtistHeatmap,
  fetchTagHeatmap,
} from "./qloo-calls";
import type { PromoteNeighborhood } from "./neighborhoods";
import { resolvePromoteNeighborhoods } from "./resolve-neighborhoods";
import type { LineupRequest } from "./schemas";
import {
  popularityBandFromConcept,
  tierLabel,
  widenPopularityBand,
} from "./tiers";
import { resolveVenueSignals, type ProvenanceRequest } from "./translate-venue";
import { venueDisplayName } from "./venue-display";

export type LineupArtist = {
  id: string;
  name: string;
  tierLabel: string;
  detail?: string;
  imageUrl?: string;
};

export type LineupVenuePin = {
  lat: number;
  lon: number;
  city: string;
};

export type { PromoteNeighborhood };

export type LineupResult = {
  venueLabel: string;
  eventLabel: string;
  venue?: LineupVenuePin;
  headliner: LineupArtist;
  opener: LineupArtist | null;
  alternates: LineupArtist[];
  neighborhoods: PromoteNeighborhood[];
  provenance: {
    requests: ProvenanceRequest[];
  };
};

function artistImageUrl(entity: QlooEntity): string | undefined {
  const url = entity.properties?.image?.url;
  return typeof url === "string" && url.trim().length > 0 ? url.trim() : undefined;
}

const NO_HEADLINER_MATCH_DETAIL =
  "No strong headliner match found for this concept.";

function entityId(entity: QlooEntity): string {
  return entity.entity_id ?? entity.id ?? entity.name;
}

function toArtist(
  entity: QlooEntity,
  rank: number,
  tier: "headliner" | "opener",
): LineupArtist {
  return {
    id: entityId(entity),
    name: entity.name,
    tierLabel: tierLabel(rank, tier),
    imageUrl: artistImageUrl(entity),
  };
}

function venuePinDto(pin: {
  lat: number;
  lon: number;
  city: string;
}): LineupVenuePin {
  return { lat: pin.lat, lon: pin.lon, city: pin.city };
}

function emptyHeadlinerPlaceholder(): LineupArtist {
  return {
    id: "no-headliner-match",
    name: "—",
    tierLabel: "Headliner",
    detail: NO_HEADLINER_MATCH_DETAIL,
  };
}

export async function buildLineup(input: LineupRequest): Promise<LineupResult> {
  const requests: ProvenanceRequest[] = [];
  const signals = await resolveVenueSignals(input, requests);
  const band = popularityBandFromConcept(input.concept);
  const pin = signals.venuePin!;

  const { artists: headlinerCandidates, qlooReturnedCount } =
    await discoverHeadliners(signals, band, requests);
  const headlinerEntity = pickHeadliner(
    headlinerCandidates,
    signals.musicTagIds,
    band,
  );

  if (!headlinerEntity) {
    if (qlooReturnedCount === 0) {
      throw new Error(
        "No artists returned for this location and taste profile. Try different genre words or a broader city search.",
      );
    }

    const heatmapData = await fetchTagHeatmap(
      signals.musicTagIds,
      signals.cityForHeatmap,
      requests,
    );
    const cacheKey = `nb:tags:${signals.musicTagIds.join(",")}:${signals.cityForHeatmap}:${pin.lat.toFixed(3)}:${pin.lon.toFixed(3)}:v4`;
    const { neighborhoods } = await resolvePromoteNeighborhoods(
      cacheKey,
      heatmapData.grid,
      heatmapData.localities,
      pin,
      {
        tagIds: signals.musicTagIds,
        fetchTagHeatmap: () =>
          fetchTagHeatmap(signals.musicTagIds, signals.cityForHeatmap, requests),
      },
    );

    return {
      venueLabel: venueDisplayName(input.concept),
      eventLabel: "Live music night",
      venue: venuePinDto(pin),
      headliner: emptyHeadlinerPlaceholder(),
      opener: null,
      alternates: [],
      neighborhoods,
      provenance: { requests },
    };
  }

  const headlinerId = entityId(headlinerEntity);
  const openerMax = openerPopularityMax(headlinerEntity.popularity ?? 0.9);

  const [openerCandidates, heatmapData] = await Promise.all([
    discoverOpeners(signals, headlinerId, openerMax, requests),
    fetchArtistHeatmap(headlinerId, signals.cityForHeatmap, requests),
  ]);

  const cacheKey = `nb:${headlinerId}:${signals.cityForHeatmap}:${pin.lat.toFixed(3)}:${pin.lon.toFixed(3)}:v4`;

  const openerPromise = pickOpener(
    openerCandidates,
    headlinerEntity,
    headlinerId,
    signals.cityForHeatmap,
    signals.musicTagIds,
    requests,
  );

  const neighborhoodsPromise = resolvePromoteNeighborhoods(
    cacheKey,
    heatmapData.grid,
    heatmapData.localities,
    pin,
    {
      tagIds: signals.musicTagIds,
      fetchTagHeatmap: () =>
        fetchTagHeatmap(signals.musicTagIds, signals.cityForHeatmap, requests),
    },
  );

  const [openerPick, neighborhoodResult] = await Promise.all([
    openerPromise,
    neighborhoodsPromise,
  ]);
  const neighborhoods = neighborhoodResult.neighborhoods;

  const openerEntity = openerPick.opener;
  const excludeFromAlternates = [headlinerEntity];
  if (openerEntity) excludeFromAlternates.push(openerEntity);

  let benchBand = band;
  let ranked = rankAlternateHeadliners(
    headlinerCandidates,
    signals.musicTagIds,
    benchBand,
    headlinerEntity,
    excludeFromAlternates,
  ).filter(
    (e) =>
      entityId(e) !== headlinerId &&
      (!openerEntity || !isSamePerson(e, openerEntity)),
  );
  if (ranked.length === 0 && (benchBand.seatCapacity ?? 999) <= 120) {
    benchBand = widenPopularityBand(benchBand, 2);
    ranked = rankAlternateHeadliners(
      headlinerCandidates,
      signals.musicTagIds,
      benchBand,
      headlinerEntity,
      excludeFromAlternates,
      { relaxObscurityForTinyRoom: true, relaxBandCapForBench: true },
    ).filter(
      (e) =>
        entityId(e) !== headlinerId &&
        (!openerEntity || !isSamePerson(e, openerEntity)),
    );
  }
  // Same Wikipedia actor-first screen the agent bench uses (Quick mode
  // was still showing actor-first acts on the bench).
  let benchPool = await filterActorFirstEntities(ranked.slice(0, 5), (e) =>
    hintsFromQlooEntity(e),
  );
  benchPool = await filterVerifiedMusicianBench(benchPool, (e) =>
    hintsFromQlooEntity(e),
  );
  const alternates = benchPool
    .slice(0, 3)
    .map((e, i) => toArtist(e, i + 2, "headliner"));

  return {
    venueLabel: venueDisplayName(input.concept),
    eventLabel: "Live music night",
    venue: venuePinDto(pin),
    headliner: toArtist(headlinerEntity, 1, "headliner"),
    opener: openerEntity ? toArtist(openerEntity, 1, "opener") : null,
    alternates,
    neighborhoods,
    provenance: { requests },
  };
}
