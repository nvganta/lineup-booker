import { pickHeadliner } from "./artist-filter";
import {
  openerDiscoveryPopularityMax,
  pickOpener,
} from "./opener-select";
import {
  discoverHeadliners,
  discoverOpeners,
  fetchArtistHeatmap,
} from "./qloo-calls";
import { filterNeighborhoodLocalities } from "./geography";
import {
  candidatesToPromoteList,
  collectGridNeighborhoodCandidates,
} from "./heatmap-neighborhoods";
import { buildMergedNeighborhoodCandidates } from "./resolve-neighborhoods";
import type { LineupRequest } from "./schemas";
import { popularityBandFromConcept } from "./tiers";
import { resolveVenueSignals, type ProvenanceRequest } from "./translate-venue";

export async function runProbe(input: LineupRequest) {
  const requests: ProvenanceRequest[] = [];
  const signals = await resolveVenueSignals(input, requests);
  const band = popularityBandFromConcept(input.concept);

  const { artists: headlinerCandidates } = await discoverHeadliners(
    signals,
    band,
    requests,
  );
  const headliner = pickHeadliner(
    headlinerCandidates,
    signals.musicTagIds,
    band,
  );
  if (!headliner) {
    return {
      error: "No headliner candidates",
      requests,
      signals: {
        city: signals.cityForHeatmap,
        pin: signals.venuePin,
        tags: signals.tagLabels,
        musicTagIds: signals.musicTagIds,
      },
    };
  }

  const headlinerId = headliner.entity_id ?? headliner.id ?? headliner.name;
  const openerMax = openerDiscoveryPopularityMax(
    headliner.popularity ?? 0.9,
    band,
  );

  const [openerCandidates, heatmapData] = await Promise.all([
    discoverOpeners(signals, headlinerId, openerMax, requests),
    fetchArtistHeatmap(headlinerId, signals.cityForHeatmap, requests),
  ]);

  const pin = signals.venuePin;

  const gridAuditPromise = pin
    ? collectGridNeighborhoodCandidates(heatmapData.grid, pin)
    : Promise.resolve({ candidates: [], audit: [] });

  const localityAuditPromise = pin
    ? filterNeighborhoodLocalities(heatmapData.localities, pin)
    : Promise.resolve({ kept: [], audit: [] });

  const openerPromise = pickOpener(
    openerCandidates,
    headliner,
    headlinerId,
    pin!,
    signals.musicTagIds,
    { requests, band, localQueryCity: signals.cityForHeatmap },
  );

  const [gridResult, localityResult, openerPick] = await Promise.all([
    gridAuditPromise,
    localityAuditPromise,
    openerPromise,
  ]);

  const mergedCandidates = pin
    ? buildMergedNeighborhoodCandidates(
        gridResult.candidates,
        localityResult.kept,
        localityResult.audit,
      )
    : [];

  const promoteList = pin
    ? candidatesToPromoteList(mergedCandidates, pin.city)
    : [];

  return {
    venue: {
      city: signals.cityForHeatmap,
      pin: signals.venuePin,
      tags: signals.tagLabels,
      musicTagIds: signals.musicTagIds,
    },
    headliner: {
      name: headliner.name,
      id: headlinerId,
      popularity: headliner.popularity,
    },
    openerMax,
    neighborhoods: {
      gridAudit: gridResult.audit,
      merged: promoteList.map((c) => c.name),
      raw: heatmapData.localities.map((r) => ({
        name: r.name,
        affinity: r.query?.affinity,
        disambiguation: r.disambiguation,
        hasBoundary: Boolean(r.properties?.boundary),
      })),
      audit: localityResult.audit,
    },
    openers: {
      raw: openerCandidates.map((o) => ({
        name: o.name,
        id: o.entity_id ?? o.id,
        popularity: o.popularity,
        affinity: o.query?.affinity,
      })),
      audit: openerPick.audit,
      selected: openerPick.opener?.name ?? null,
    },
    requests,
  };
}
