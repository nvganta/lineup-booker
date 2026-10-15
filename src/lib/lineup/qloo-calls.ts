import { qlooGet } from "@/lib/qloo/client";
import type {
  QlooEntity,
  QlooHeatmapPoint,
  QlooInsightsResponse,
} from "@/lib/qloo/types";
import { filterMusicArtists } from "./artist-filter";
import { trimHeatmapLocalities, type LocalityRow } from "./geography";
import type { PopularityBand } from "./tiers";
import type { ProvenanceRequest, VenueSignals } from "./translate-venue";

function applyLocationSignal(
  params: Record<string, string | number | boolean | undefined>,
  signals: VenueSignals,
): void {
  if (signals.signalLocationPoint) {
    params["signal.location"] = signals.signalLocationPoint;
  } else {
    params["signal.location.query"] = signals.locationQuery;
  }
}

export type HeadlinerDiscovery = {
  artists: QlooEntity[];
  qlooReturnedCount: number;
};

export async function discoverHeadliners(
  signals: VenueSignals,
  band: PopularityBand,
  requests: ProvenanceRequest[],
): Promise<HeadlinerDiscovery> {
  if (signals.musicTagIds.length === 0) {
    throw new Error(
      "Could not map what regulars love to music taste tags. Add genre words (e.g. indie folk, jazz, soul).",
    );
  }

  let qlooReturnedCount = 0;

  async function runQuery(activeBand: PopularityBand): Promise<QlooEntity[]> {
    const params: Record<string, string | number | boolean | undefined> = {
      "filter.type": "urn:entity:artist",
      "signal.interests.tags": signals.musicTagIds.join(","),
      "operator.signal.interests.tags": "union",
      take: 12,
    };

    applyLocationSignal(params, signals);

    if (activeBand.headlinerMin !== undefined) {
      params["filter.popularity.min"] = activeBand.headlinerMin;
    }
    if (activeBand.headlinerMax !== undefined) {
      params["filter.popularity.max"] = activeBand.headlinerMax;
    }

    const { data, request } = await qlooGet<QlooInsightsResponse>(
      "/v2/insights",
      params,
    );
    requests.push(request);
    const raw = data.results?.entities ?? [];
    qlooReturnedCount = Math.max(qlooReturnedCount, raw.length);
    return filterMusicArtists(raw, signals.musicTagIds);
  }

  let artists = await runQuery(band);
  if (artists.length === 0) {
    const relaxed: PopularityBand = {
      ...band,
      headlinerMin: undefined,
      headlinerMax: undefined,
    };
    artists = await runQuery(relaxed);
  }

  return { artists, qlooReturnedCount };
}

export async function discoverOpeners(
  signals: VenueSignals,
  headlinerId: string,
  openerPopularityMax: number,
  requests: ProvenanceRequest[],
): Promise<QlooEntity[]> {
  const params: Record<string, string | number | boolean | undefined> = {
    "filter.type": "urn:entity:artist",
    "signal.interests.entities": headlinerId,
    "signal.interests.tags": signals.musicTagIds.join(","),
    "operator.signal.interests.tags": "intersection",
    "filter.popularity.max": openerPopularityMax,
    "filter.exclude.entities": headlinerId,
    take: 10,
  };

  applyLocationSignal(params, signals);

  const { data, request } = await qlooGet<QlooInsightsResponse>(
    "/v2/insights",
    params,
  );
  requests.push(request);
  return filterMusicArtists(
    data.results?.entities ?? [],
    signals.musicTagIds,
  );
}

export type ArtistHeatmapData = {
  grid: QlooHeatmapPoint[];
  localities: LocalityRow[];
};

export async function fetchArtistHeatmap(
  artistId: string,
  cityQuery: string,
  requests: ProvenanceRequest[],
): Promise<ArtistHeatmapData> {
  const heatmapBase = {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": artistId,
    "filter.location.query": cityQuery,
  } as const;

  const [gridRes, localityRes] = await Promise.all([
    qlooGet<QlooInsightsResponse>("/v2/insights", { ...heatmapBase, take: 40 }),
    qlooGet<QlooInsightsResponse>("/v2/insights", {
      ...heatmapBase,
      "output.heatmap.boundary": "urn:entity:locality",
      take: 8,
    }),
  ]);

  requests.push(gridRes.request, localityRes.request);

  const localities = trimHeatmapLocalities(
    (localityRes.data.results?.entities ?? []) as LocalityRow[],
  );

  return {
    grid: gridRes.data.results?.heatmap ?? [],
    localities,
  };
}

/** @deprecated use fetchArtistHeatmap */
export async function fetchLocalityHeatmap(
  artistId: string,
  cityQuery: string,
  requests: ProvenanceRequest[],
): Promise<LocalityRow[]> {
  const { localities } = await fetchArtistHeatmap(
    artistId,
    cityQuery,
    requests,
  );
  return localities;
}

export async function fetchTagHeatmap(
  tagIds: string[],
  cityQuery: string,
  requests: ProvenanceRequest[],
): Promise<ArtistHeatmapData> {
  if (tagIds.length === 0) {
    return { grid: [], localities: [] };
  }

  const heatmapBase = {
    "filter.type": "urn:heatmap",
    "signal.interests.tags": tagIds.join(","),
    "operator.signal.interests.tags": "union",
    "filter.location.query": cityQuery,
  } as const;

  const [gridRes, localityRes] = await Promise.all([
    qlooGet<QlooInsightsResponse>("/v2/insights", { ...heatmapBase, take: 40 }),
    qlooGet<QlooInsightsResponse>("/v2/insights", {
      ...heatmapBase,
      "output.heatmap.boundary": "urn:entity:locality",
      take: 8,
    }),
  ]);

  requests.push(gridRes.request, localityRes.request);

  return {
    grid: gridRes.data.results?.heatmap ?? [],
    localities: trimHeatmapLocalities(
      (localityRes.data.results?.entities ?? []) as LocalityRow[],
    ),
  };
}
