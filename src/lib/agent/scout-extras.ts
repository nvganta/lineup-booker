import { getAgentRuntime } from "@/lib/agent/runtime";
import { attachImageUrl } from "@/lib/agent/lookup-artist";
import { headlinerDiscoverySignals } from "@/lib/agent/qloo-signals";
import {
  discoverOpeners,
  fetchArtistHeatmap,
  fetchTagHeatmap,
} from "@/lib/lineup/qloo-calls";
import {
  humanOpenerRejectReason,
  openerDiscoveryPopularityMax,
  pickOpener,
} from "@/lib/lineup/opener-select";
import { persistOpenerPickToSession } from "@/lib/lineup/opener-session";
import { fetchHeadlinerDemographics } from "@/lib/lineup/demographics-qloo";
import { formatCrowdDisplay } from "@/lib/lineup/crowd-display";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";
import { resolvePromoteNeighborhoods } from "@/lib/lineup/resolve-neighborhoods";
import type { QlooEntity } from "@/lib/qloo/types";
import type { ProvenanceRequest } from "@/lib/lineup/translate-venue";
import { hintsFromQlooEntity } from "@/lib/agent/research/qloo-hints";
import { scheduleArtistResearch } from "@/lib/agent/research/scheduler";

function rt() {
  const runtime = getAgentRuntime();
  if (!runtime) throw new Error("Agent runtime missing");
  return runtime;
}

function streetHintFrom(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const first = parts.find((p) => !/^\d+[a-z]?$/i.test(p));
  return first?.replace(/^\d+[a-z]?\s+/i, "") || parts[0] || address;
}

export async function runScoutExtrasParallel(input: {
  concept: string;
  address: string;
  tagIds: string[];
}): Promise<void> {
  const session = rt().session;
  const writer = rt().writer;
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

      for (const row of pick.audit) {
        if (row.kept || row.reason === "selected") continue;
        if (row.reason === "runner-up for opener slot") continue;
        writer.writeStep({
          id: crypto.randomUUID(),
          kind: "opener",
          status: "weak",
          label: `Rejected ${row.name}: ${humanOpenerRejectReason(row.reason)}.`,
        });
      }

      const opener = pick.opener
        ? await attachImageUrl(pick.opener, requests)
        : null;
      await persistOpenerPickToSession(session, pick, opener, requests);

      if (opener) {
        const openerDto = session.openerEntity!;
        const kept = pick.audit.find((a) => a.kept);
        writer.writeStep({
          id: crypto.randomUUID(),
          kind: "opener",
          status: "done",
          label: kept?.originMatch
            ? `Local opener: ${openerDto.name}.`
            : `Opener: ${openerDto.name}.`,
        });
        writer.writeArtist({
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
      } else {
        writer.writeStep({
          id: crypto.randomUUID(),
          kind: "opener",
          status: "weak",
          label: "No opener cleared the room filters.",
        });
      }
    })(),
    (async () => {
      const requests: ProvenanceRequest[] = [];
      const street = streetHintFrom(input.address);
      writer.writeStep({
        id: crypto.randomUUID(),
        kind: "neighborhoods",
        status: "running",
        label: `Mapping neighbourhoods near ${street}.`,
      });
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
      writer.writeMap({
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
      let nbDetail: string | undefined;
      if (meta.usedTagHeatmap || meta.usedRingFallback) {
        const parts: string[] = [];
        if (meta.usedTagHeatmap) {
          parts.push("some areas from genre fan clusters");
        }
        if (meta.usedRingFallback) {
          parts.push("some from nearest neighbourhoods to the room");
        }
        nbDetail = `Headliner fan map was thin; ${parts.join(", and ")}.`;
      }
      writer.writeStep({
        id: crypto.randomUUID(),
        kind: "neighborhoods",
        status: mapped.length >= 2 ? "done" : "weak",
        label:
          mapped.length >= 2
            ? `Ranked ${mapped.length} neighbourhoods to poster first.`
            : "Fan heat map was sparse nearby.",
        detail: nbDetail,
      });
    })(),
    (async () => {
      const requests: ProvenanceRequest[] = [];
      const { demographics } = await fetchHeadlinerDemographics(
        headlinerId,
        pin.city,
        requests,
      );
      session.crowdDemographics = demographics;
      const crowdLabel = formatCrowdDisplay(demographics);
      if (crowdLabel) {
        writer.writeStep({
          id: crypto.randomUUID(),
          kind: "crowd",
          status: "done",
          label: crowdLabel,
        });
      } else {
        writer.writeStep({
          id: crypto.randomUUID(),
          kind: "crowd",
          status: "weak",
          label: "Crowd age data wasn't clear enough to claim.",
        });
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
