import { qlooGet } from "@/lib/qloo/client";
import type { QlooEntity, QlooInsightsResponse } from "@/lib/qloo/types";
import {
  filterMusicArtists,
  isMusicArtist,
  isOpenerTooFamousForSmallRoom,
  isSamePerson,
} from "./artist-filter";
import { gatherArtistOriginTexts } from "./artist-origin-sources";
import { artistOriginMatchesVenue, type VenuePin } from "./geography";
import type { PopularityBand } from "./tiers";
import type { ProvenanceRequest } from "./translate-venue";
import { isActorFirstByWikipedia } from "@/lib/agent/research/actor-screen";
import { hintsFromQlooEntity } from "@/lib/agent/research/qloo-hints";

export type OpenerAudit = {
  name: string;
  id: string;
  popularity?: number;
  hasLocalSignal: boolean;
  kept: boolean;
  reason: string;
};

export function openerPopularityMax(headlinerPopularity: number): number {
  const gap = 0.03;
  return Math.max(0, headlinerPopularity - gap);
}

/** Cap used for Qloo opener discovery and pick (tightens for small rooms). */
export function openerDiscoveryPopularityMax(
  headlinerPopularity: number,
  band?: PopularityBand,
): number {
  const relative = openerPopularityMax(headlinerPopularity);
  if (!band?.seatCapacity || band.seatCapacity > 300) return relative;
  return Math.min(relative, band.openerMax);
}

async function hasLocalSignalInCity(
  artistId: string,
  city: string,
  requests: ProvenanceRequest[],
): Promise<boolean> {
  const { data, request } = await qlooGet<QlooInsightsResponse>(
    "/v2/insights",
    {
      "filter.type": "urn:entity:artist",
      "filter.results.entities": artistId,
      "signal.location.query": city,
      take: 5,
    },
  );
  requests.push(request);
  return (data.results?.entities ?? []).some(
    (e) => (e.entity_id ?? e.id) === artistId,
  );
}

export type PickOpenerOptions = {
  requests?: ProvenanceRequest[];
  band?: PopularityBand;
  /** Prod queried Qloo with cityForHeatmap; defaults to pin.city */
  localQueryCity?: string;
};

const OPENER_BATCH_SIZE = 2;

async function candidateHasLocalSignal(
  candidate: QlooEntity,
  pin: VenuePin,
  localQueryCity: string,
  requests: ProvenanceRequest[],
): Promise<{ ok: boolean; reason: string }> {
  const hints = hintsFromQlooEntity(candidate);
  const entityId = candidate.entity_id ?? candidate.id;
  const originTexts = await gatherArtistOriginTexts(
    candidate.name,
    hints,
    entityId,
  );

  if (originTexts.length > 0) {
    const mismatches = originTexts.filter(
      (origin) => !artistOriginMatchesVenue(origin, pin),
    );
    if (mismatches.length > 0) {
      return {
        ok: false,
        reason: "origin outside venue city or borough",
      };
    }
    return { ok: true, reason: "origin matches venue" };
  }

  const id = entityId ?? candidate.name;
  const qlooLocal = await hasLocalSignalInCity(id, localQueryCity, requests);
  if (qlooLocal) {
    return { ok: true, reason: "local signal in city (no origin data)" };
  }
  return { ok: false, reason: "no local signal in city" };
}

export async function pickOpener(
  candidates: QlooEntity[],
  headliner: QlooEntity,
  headlinerId: string,
  pin: VenuePin,
  genreTagIds: string[],
  options: PickOpenerOptions = {},
): Promise<{ opener: QlooEntity | null; audit: OpenerAudit[] }> {
  const requests = options.requests ?? [];
  const band = options.band;
  const localQueryCity = options.localQueryCity ?? pin.city;
  const headlinerPop = headliner.popularity ?? 1;
  const popCap = openerDiscoveryPopularityMax(headlinerPop, band);
  const audit: OpenerAudit[] = [];
  const filtered = filterMusicArtists(candidates, genreTagIds, [headliner]);

  for (let i = 0; i < filtered.length; i += OPENER_BATCH_SIZE) {
    const batch = filtered.slice(i, i + OPENER_BATCH_SIZE);
    const localResults = await Promise.all(
      batch.map((candidate) =>
        candidateHasLocalSignal(candidate, pin, localQueryCity, requests),
      ),
    );

    for (let j = 0; j < batch.length; j++) {
      const candidate = batch[j]!;
      const id = candidate.entity_id ?? candidate.id ?? candidate.name;
      const base = {
        name: candidate.name,
        id,
        popularity: candidate.popularity,
        hasLocalSignal: false,
        kept: false,
        reason: "",
      };

      if (id === headlinerId || isSamePerson(candidate, headliner)) {
        audit.push({ ...base, reason: "same act as headliner" });
        continue;
      }

      if (!isMusicArtist(candidate, genreTagIds)) {
        audit.push({ ...base, reason: "not a music artist for this genre" });
        continue;
      }

      if ((candidate.popularity ?? 0) >= headlinerPop - 0.02) {
        audit.push({ ...base, reason: "not less popular than headliner" });
        continue;
      }

      if (
        (candidate.popularity ?? 0) > popCap ||
        isOpenerTooFamousForSmallRoom(candidate, band)
      ) {
        audit.push({
          ...base,
          reason: "above room opener popularity cap",
        });
        continue;
      }

      const local = localResults[j];
      if (!local?.ok) {
        audit.push({
          ...base,
          reason: local?.reason ?? "not based in venue city or borough",
        });
        continue;
      }

      if (
        await isActorFirstByWikipedia(
          candidate.name,
          hintsFromQlooEntity(candidate),
        )
      ) {
        audit.push({ ...base, reason: "actor-first profile (public bio)" });
        continue;
      }

      audit.push({
        ...base,
        hasLocalSignal: true,
        kept: true,
        reason: "selected",
      });
      return { opener: candidate, audit };
    }
  }

  return { opener: null, audit };
}
