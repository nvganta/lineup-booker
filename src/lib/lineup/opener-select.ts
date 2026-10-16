import { qlooGet } from "@/lib/qloo/client";
import type { QlooEntity, QlooInsightsResponse } from "@/lib/qloo/types";
import {
  filterMusicArtists,
  isMusicArtist,
  isSamePerson,
} from "./artist-filter";
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

const OPENER_BATCH_SIZE = 2;

export async function pickOpener(
  candidates: QlooEntity[],
  headliner: QlooEntity,
  headlinerId: string,
  city: string,
  genreTagIds: string[],
  requests: ProvenanceRequest[],
): Promise<{ opener: QlooEntity | null; audit: OpenerAudit[] }> {
  const headlinerPop = headliner.popularity ?? 1;
  const audit: OpenerAudit[] = [];
  const filtered = filterMusicArtists(candidates, genreTagIds, [headliner]);

  for (let i = 0; i < filtered.length; i += OPENER_BATCH_SIZE) {
    const batch = filtered.slice(i, i + OPENER_BATCH_SIZE);
    const localResults = await Promise.all(
      batch.map(async (candidate) => {
        const id = candidate.entity_id ?? candidate.id ?? candidate.name;
        return hasLocalSignalInCity(id, city, requests);
      }),
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

      const local = localResults[j] ?? false;
      if (!local) {
        audit.push({ ...base, reason: "no local signal in city" });
        continue;
      }

      if (await isActorFirstByWikipedia(candidate.name, hintsFromQlooEntity(candidate))) {
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
