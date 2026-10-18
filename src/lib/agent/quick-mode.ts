import { buildLineup } from "@/lib/lineup/build-lineup";
import type { LineupRequest } from "@/lib/lineup/schemas";
import type { AgentSessionState, PitchPayload } from "./types";
import type { StreamWriter } from "./types";
import { venueDisplayName } from "@/lib/lineup/venue-display";
import { enrichPitchWithArtistResearch } from "./research/quick-research";
import type { ArtistResearchInput } from "./research/types";
import {
  pitchFromAgentSession,
  promoNeighborhoodsWithHomeFirst,
} from "./quick-from-session";
import {
  homeNeighborhoodFromPin,
  prependHomeToPromoteList,
} from "@/lib/lineup/venue-home-area";
import type { VenuePin } from "@/lib/lineup/geography";
import {
  fallbackMoodLine,
  headlinerFitLine,
  openerLocalLine,
} from "./pitch-catalog";
export function lineupToPitch(
  input: LineupRequest,
  lineup: Awaited<ReturnType<typeof buildLineup>>,
  priorSession?: AgentSessionState,
): PitchPayload {
  // Same plain copy as the agent's catalog, using whatever styles the scout
  // already read before it handed off.
  const copySession = {
    headlinerEntity: lineup.headliner,
    openerEntity: lineup.opener ?? undefined,
    tagLabels: priorSession?.tagLabels ?? [],
  } as unknown as AgentSessionState;
  return {
    venueLabel: lineup.venueLabel || venueDisplayName(input.concept),
    address: input.location,
    moodLine: fallbackMoodLine(copySession),
    headlinerWhy: headlinerFitLine(copySession),
    openerWhy:
      openerLocalLine(copySession) ??
      "No local opener stood out this time.",
    headliner: {
      id: lineup.headliner.id,
      name: lineup.headliner.name,
      imageUrl: lineup.headliner.imageUrl,
    },
    opener: lineup.opener
      ? {
          id: lineup.opener.id,
          name: lineup.opener.name,
          imageUrl: lineup.opener.imageUrl,
        }
      : null,
    alternates: lineup.alternates.map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
    })),
    neighborhoods: applyHomeFirstToLineupNeighborhoods(
      lineup.neighborhoods.map((n) => ({
        rank: n.rank,
        name: n.name,
        lat: n.lat,
        lon: n.lon,
      })),
      priorSession?.pin,
    ),
    openerSwapQueue: lineup.openerSwapQueue,
    crowdDemographics: lineup.crowdDemographics ?? null,
    meta: lineup.pitchMeta,
    evidenceFootnotes: {
      mode: "Quick mode: standard lineup, no AI scout.",
    },
  };
}

function applyHomeFirstToLineupNeighborhoods(
  neighborhoods: PitchPayload["neighborhoods"],
  pin?: VenuePin,
): PitchPayload["neighborhoods"] {
  if (!pin || neighborhoods.length === 0) return neighborhoods;
  const home = homeNeighborhoodFromPin(pin);
  if (!home) return neighborhoods;
  return prependHomeToPromoteList(
    neighborhoods.map((n) => ({
      rank: n.rank,
      name: n.name,
      lat: n.lat ?? pin.lat,
      lon: n.lon ?? pin.lon,
    })),
    pin,
    home,
  );
}

export async function runQuickMode(
  input: LineupRequest,
  writer: StreamWriter,
  startedAt: number,
  priorQlooLookups: number,
  priorSession?: AgentSessionState,
): Promise<PitchPayload> {
  const stepId = crypto.randomUUID();
  const reused = priorSession?.headlinerEntity
    ? pitchFromAgentSession(input, priorSession)
    : null;
  let pitch: PitchPayload;
  let qlooDelta = 0;

  if (reused) {
    pitch = reused;
    if (priorSession?.headlinerEntity) {
      writer.writeArtist({
        id: priorSession.headlinerEntity.id,
        name: priorSession.headlinerEntity.name,
        imageUrl: priorSession.headlinerEntity.imageUrl,
        role: "headliner",
      });
    }
    if (priorSession?.openerEntity) {
      writer.writeArtist({
        id: priorSession.openerEntity.id,
        name: priorSession.openerEntity.name,
        imageUrl: priorSession.openerEntity.imageUrl,
        role: "opener",
      });
    }
    const promoPins = promoNeighborhoodsWithHomeFirst(priorSession!);
    if (priorSession?.pin && promoPins.length) {
      writer.writeMap({
        venue: { lat: priorSession.pin.lat, lon: priorSession.pin.lon },
        pins: promoPins
          .filter((n) => n.lat != null && n.lon != null)
          .map((n) => ({
            rank: n.rank,
            name: n.name,
            lat: n.lat!,
            lon: n.lon!,
          })),
      });
    }
  } else {
    const lineup = await buildLineup(input);
    qlooDelta = lineup.provenance?.requests?.length ?? 0;
    const researchInputs: ArtistResearchInput[] = [];
    if (lineup.headliner?.name) {
      researchInputs.push({ id: lineup.headliner.id, name: lineup.headliner.name });
    }
    if (lineup.opener?.name) {
      researchInputs.push({ id: lineup.opener.id, name: lineup.opener.name });
    }
    pitch = await enrichPitchWithArtistResearch(
      lineupToPitch(input, lineup, priorSession),
      researchInputs,
    );
    if (lineup.headliner.imageUrl) {
      writer.writeArtist({
        id: lineup.headliner.id,
        name: lineup.headliner.name,
        imageUrl: lineup.headliner.imageUrl,
        role: "headliner",
      });
    }
    if (lineup.opener) {
      writer.writeArtist({
        id: lineup.opener.id,
        name: lineup.opener.name,
        imageUrl: lineup.opener.imageUrl,
        role: "opener",
      });
    }
    if (lineup.venue && lineup.neighborhoods.length) {
      writer.writeMap({
        venue: { lat: lineup.venue.lat, lon: lineup.venue.lon },
        pins: lineup.neighborhoods
          .filter((n) => n.lat != null && n.lon != null)
          .map((n) => ({
            rank: n.rank,
            name: n.name,
            lat: n.lat!,
            lon: n.lon!,
          })),
      });
    }
  }

  writer.writePitch(pitch);
  writer.writeStep({
    id: stepId,
    kind: "quick",
    status: "done",
    label: reused
      ? "Wrapped up from the scout's cached picks (Quick mode)."
      : "Standard lineup ready (Quick mode).",
    why: reused
      ? "Reused headliner, opener, and promo areas from the agent pass."
      : "Standard lineup pipeline, no AI scout.",
  });
  writer.writeSummary({
    elapsedSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
    qlooLookups: priorQlooLookups + qlooDelta,
    retries: 0,
    quickMode: true,
  });
  return pitch;
}
