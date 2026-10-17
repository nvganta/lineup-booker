import { hintsFromQlooEntity } from "@/lib/agent/research/qloo-hints";
import type { QlooEntity } from "@/lib/qloo/types";
import { selectBenchEntities } from "./bench-select";
import { pickHeadlinerForVenue } from "./headliner-local-pick";
import {
  openerDiscoveryPopularityMax,
  pickOpener,
} from "./opener-select";
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
  const headlinerEntity = await pickHeadlinerForVenue(
    headlinerCandidates,
    signals.musicTagIds,
    band,
    pin,
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
  const openerMax = openerDiscoveryPopularityMax(
    headlinerEntity.popularity ?? 0.9,
    band,
  );

  const [openerCandidates, heatmapData] = await Promise.all([
    discoverOpeners(signals, headlinerId, openerMax, requests),
    fetchArtistHeatmap(headlinerId, signals.cityForHeatmap, requests),
  ]);

  const cacheKey = `nb:${headlinerId}:${signals.cityForHeatmap}:${pin.lat.toFixed(3)}:${pin.lon.toFixed(3)}:v4`;

  const openerPromise = pickOpener(
    openerCandidates,
    headlinerEntity,
    headlinerId,
    pin,
    signals.musicTagIds,
    { requests, band, localQueryCity: signals.cityForHeatmap },
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

  const benchPool = await selectBenchEntities(
    headlinerCandidates,
    signals.musicTagIds,
    band,
    headlinerEntity,
    excludeFromAlternates,
    (e) => hintsFromQlooEntity(e),
  );
  const alternates = benchPool.map((e, i) => toArtist(e, i + 2, "headliner"));

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
