import type { QlooEntity } from "@/lib/qloo/types";
import {
  filterMusicArtists,
  isMusicArtist,
  isOpenerTooFamousForSmallRoom,
  isSamePerson,
} from "./artist-filter";
import { gatherArtistOriginTexts } from "./artist-origin-sources";
import {
  artistOriginMatchesVenue,
  originHasSpecificLocality,
  type VenuePin,
} from "./geography";
import { isPlausiblePlaceOrigin } from "./origin-place";
import type { PopularityBand } from "./tiers";
import type { ProvenanceRequest } from "./translate-venue";
import { isActorFirstByWikipedia } from "@/lib/agent/research/actor-screen";
import { hintsFromQlooEntity } from "@/lib/agent/research/qloo-hints";

export type OpenerAudit = {
  name: string;
  id: string;
  popularity?: number;
  hasLocalSignal: boolean;
  originMatch?: boolean;
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

export type PickOpenerOptions = {
  requests?: ProvenanceRequest[];
  band?: PopularityBand;
  /** Prod queried Qloo with cityForHeatmap; defaults to pin.city */
  localQueryCity?: string;
};

const OPENER_BATCH_SIZE = 2;

export async function evaluateOpenerLocalEvidence(
  candidate: QlooEntity,
  pin: VenuePin,
): Promise<{
  ok: boolean;
  reason: string;
  hasLocalSignal: boolean;
  originMatch?: boolean;
}> {
  const hints = hintsFromQlooEntity(candidate);
  const entityId = candidate.entity_id ?? candidate.id;
  const originTexts = await gatherArtistOriginTexts(
    candidate.name,
    hints,
    entityId,
  );

  if (originTexts.length > 0) {
    const placeLike = originTexts.filter(
      (origin) =>
        isPlausiblePlaceOrigin(origin) && originHasSpecificLocality(origin),
    );
    if (placeLike.length === 0) {
      return {
        ok: true,
        reason: "fits opener pool for this room (no origin on file)",
        hasLocalSignal: false,
      };
    }
    const matching = placeLike.filter((origin) =>
      artistOriginMatchesVenue(origin, pin),
    );
    if (matching.length === 0) {
      return {
        ok: false,
        reason: "origin outside venue city or borough",
        hasLocalSignal: false,
      };
    }
    return {
      ok: true,
      reason: "origin matches venue",
      hasLocalSignal: true,
      originMatch: true,
    };
  }

  return {
    ok: true,
    reason: "fits opener pool for this room (no origin on file)",
    hasLocalSignal: false,
  };
}

export async function pickOpener(
  candidates: QlooEntity[],
  headliner: QlooEntity,
  headlinerId: string,
  pin: VenuePin,
  genreTagIds: string[],
  options: PickOpenerOptions = {},
): Promise<{
  opener: QlooEntity | null;
  audit: OpenerAudit[];
  swapCandidates: Array<{ entity: QlooEntity; reason: string }>;
}> {
  const band = options.band;
  const audit: OpenerAudit[] = [];
  const swapCandidates: Array<{ entity: QlooEntity; reason: string }> = [];
  const filtered = filterMusicArtists(candidates, genreTagIds, [headliner]);

  for (let i = 0; i < filtered.length; i += OPENER_BATCH_SIZE) {
    const batch = filtered.slice(i, i + OPENER_BATCH_SIZE);
    const localResults = await Promise.all(
      batch.map((candidate) => evaluateOpenerLocalEvidence(candidate, pin)),
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

      const headlinerPop = headliner.popularity ?? 1;
      const popCap = openerDiscoveryPopularityMax(headlinerPop, band);

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
          reason: local.reason,
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

      const pickReason = local.reason;
      const alreadyHaveOpener = swapCandidates.length > 0;
      audit.push({
        ...base,
        hasLocalSignal: local.hasLocalSignal,
        originMatch: local.originMatch,
        kept: !alreadyHaveOpener,
        reason: alreadyHaveOpener
          ? "runner-up for opener slot"
          : "selected",
      });
      swapCandidates.push({ entity: candidate, reason: pickReason });
    }
  }

  return {
    opener: swapCandidates[0]?.entity ?? null,
    audit,
    swapCandidates,
  };
}

export function swapQueueFromCandidates(
  swapCandidates: Array<{ entity: QlooEntity; reason: string }>,
  skipId?: string,
): Array<{ id: string; name: string; reason: string }> {
  return swapCandidates
    .filter((c) => {
      const id = c.entity.entity_id ?? c.entity.id ?? c.entity.name;
      return id !== skipId;
    })
    .map((c) => ({
      id: c.entity.entity_id ?? c.entity.id ?? c.entity.name,
      name: c.entity.name,
      reason: c.reason,
    }));
}

export function humanOpenerRejectReason(reason: string): string {
  switch (reason) {
    case "origin outside venue city or borough":
      return "origin outside this city";
    case "origin not specific enough":
      return "origin wasn't city-specific";
    case "above room opener popularity cap":
      return "too famous for this room";
    case "actor-first profile (public bio)":
      return "actor-first public profile";
    case "not less popular than headliner":
      return "not below headliner popularity";
    case "not a music artist for this genre":
      return "not a match for the room's genres";
    case "same act as headliner":
      return "same act as headliner";
    case "runner-up for opener slot":
      return "next in line after the picked opener";
    default:
      return reason.replace(/_/g, " ");
  }
}
