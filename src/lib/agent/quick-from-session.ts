import type { LineupRequest } from "@/lib/lineup/schemas";
import type { AgentSessionState, PitchPayload } from "./types";
import { venueDisplayName } from "@/lib/lineup/venue-display";
import { withoutOpener } from "./runtime";
import { applyArtistBackgroundsToPitch } from "./research/apply-pitch";
import {
  fallbackMoodLine,
  headlinerFitLine,
  openerLocalLine,
} from "./pitch-catalog";
import {
  homeNeighborhoodFromPin,
  prependHomeToPromoteList,
} from "@/lib/lineup/venue-home-area";
/** Keep the venue's home neighbourhood at rank 1 for Quick / salvage copy. */
export function promoNeighborhoodsWithHomeFirst(
  session: AgentSessionState,
): PitchPayload["neighborhoods"] {
  const pin = session.pin;
  if (!pin || session.neighborhoods.length === 0) {
    return session.neighborhoods;
  }
  const home = homeNeighborhoodFromPin(pin);
  if (!home) return session.neighborhoods;
  return prependHomeToPromoteList(session.neighborhoods, pin, home);
}

/** Reuse scout evidence when Quick mode runs after a partial agent pass. */
export function pitchFromAgentSession(
  input: LineupRequest,
  session: AgentSessionState,
): PitchPayload | null {
  const headliner = session.headlinerEntity;
  if (!headliner) return null;

  const backgrounds = session.artistBackgrounds ?? {};
  const neighborhoods = promoNeighborhoodsWithHomeFirst(session);
  let pitch: PitchPayload = {
    venueLabel: venueDisplayName(input.concept),
    address: input.location,
    moodLine: fallbackMoodLine(session),
    headlinerWhy: headlinerFitLine(session),
    openerWhy:
      openerLocalLine(session) ?? "No local opener stood out this time.",
    crowdLine: session.crowdLine,
    headliner,
    opener: session.openerEntity ?? null,
    alternates: withoutOpener(session),
    neighborhoods,
    evidenceFootnotes: {
      mode: "Quick mode using the scout's cached picks.",
    },
  };
  pitch = applyArtistBackgroundsToPitch(pitch, backgrounds);
  return pitch;
}
