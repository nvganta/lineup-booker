import { getAgentRuntime } from "@/lib/agent/runtime";
import { attachImageUrl, artistImageFromEntity } from "@/lib/agent/lookup-artist";
import { headlinerDiscoverySignals } from "@/lib/agent/qloo-signals";
import {
  discoverOpeners,
  fetchArtistHeatmap,
  fetchTagHeatmap,
} from "@/lib/lineup/qloo-calls";
import {
  openerDiscoveryPopularityMax,
  pickOpener,
} from "@/lib/lineup/opener-select";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";
import { resolvePromoteNeighborhoods } from "@/lib/lineup/resolve-neighborhoods";
import { qlooGet } from "@/lib/qloo/client";
import type { QlooEntity, QlooInsightsResponse } from "@/lib/qloo/types";
import type { ProvenanceRequest } from "@/lib/lineup/translate-venue";
import { hintsFromQlooEntity } from "@/lib/agent/research/qloo-hints";
import { scheduleArtistResearch } from "@/lib/agent/research/scheduler";

function rt() {
  const runtime = getAgentRuntime();
  if (!runtime) throw new Error("Agent runtime missing");
  return runtime;
}

export async function runScoutExtrasParallel(input: {
  concept: string;
  address: string;
  tagIds: string[];
}): Promise<void> {
  const session = rt().session;
  const pin = session.pin;
  const headlinerId = session.headlinerId;
  if (!pin || !headlinerId) return;

  const headlinerPop = session.headlinerEntity?.popularity ?? 0.9;
  const band =
    session.band ?? popularityBandFromConcept(input.concept);
  const popMax = openerDiscoveryPopularityMax(headlinerPop, band);
  const signals = headlinerDiscoverySignals(
    pin,
    input.address,
    input.tagIds,
    session.tagLabels,
  );

  const settled = await Promise.allSettled([
    (async () => {
      const requests: ProvenanceRequest[] = [];
      const candidates = await discoverOpeners(
        signals,
        headlinerId,
        popMax,
        requests,
      );
      const headlinerEntity = {
        entity_id: headlinerId,
        id: headlinerId,
        name: session.headlinerEntity?.name ?? "Headliner",
        popularity: headlinerPop,
      } satisfies QlooEntity;
      const pick = await pickOpener(
        candidates,
        headlinerEntity,
        headlinerId,
        pin,
        input.tagIds,
        {
          requests,
          band,
          localQueryCity: signals.cityForHeatmap,
        },
      );
      const opener = pick.opener
        ? await attachImageUrl(pick.opener, requests)
        : null;
      if (opener) {
        const openerDto = {
          id: opener.entity_id ?? opener.id ?? opener.name,
          name: opener.name,
          imageUrl: artistImageFromEntity(opener),
        };
        session.openerEntity = openerDto;
        rt().writer.writeArtist({
          id: openerDto.id,
          name: openerDto.name,
          imageUrl: openerDto.imageUrl,
          role: "opener",
        });
        scheduleArtistResearch(session, {
          id: openerDto.id,
          name: openerDto.name,
          hints: hintsFromQlooEntity(opener),
        });
      }
    })(),
    (async () => {
      const requests: ProvenanceRequest[] = [];
      const heatmap = await fetchArtistHeatmap(
        headlinerId,
        pin.city,
        requests,
      );
      const cacheKey = `agent:nb:${headlinerId}:${pin.city}:${pin.lat.toFixed(3)}:${pin.lon.toFixed(3)}`;
      const requestsNb: ProvenanceRequest[] = [];
      const { neighborhoods, meta } = await resolvePromoteNeighborhoods(
        cacheKey,
        heatmap.grid,
        heatmap.localities,
        pin,
        {
          tagIds: input.tagIds,
          fetchTagHeatmap: () =>
            fetchTagHeatmap(input.tagIds, pin.city, requestsNb),
        },
      );
      session.neighborhoodResolveMeta = meta;
      const mapped = neighborhoods.map((n) => ({
        rank: n.rank,
        name: n.name,
        lat: n.lat,
        lon: n.lon,
      }));
      session.neighborhoods = mapped;
      for (const n of mapped) session.knownNames.add(n.name);
      rt().writer.writeMap({
        venue: { lat: pin.lat, lon: pin.lon },
        pins: mapped
          .filter((n) => n.lat != null && n.lon != null)
          .map((n) => ({
            rank: n.rank,
            name: n.name,
            lat: n.lat!,
            lon: n.lon!,
          })),
      });
    })(),
    (async () => {
      const { data } = await qlooGet<QlooInsightsResponse>("/v2/insights", {
        "filter.type": "urn:demographics",
        "signal.interests.entities": headlinerId,
        take: 5,
      });
      const entities = data.results?.entities ?? [];
      const ageBand = entities.find((e) =>
        /^\d+\s*[-–]\s*\d+/.test(e.name ?? ""),
      );
      if (ageBand?.name) {
        session.crowdLine = `Listeners nearby skew toward ages ${ageBand.name}.`;
      } else {
        session.crowdLine = undefined;
      }
    })(),
  ]);
  const labels = ["opener", "neighborhoods", "crowd"];
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[agent] scout ${labels[i]} failed:`, r.reason);
    }
  });
}
