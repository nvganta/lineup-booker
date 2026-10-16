import type { LineupRequest } from "@/lib/lineup/schemas";
import type { AgentSessionState, PitchPayload } from "./types";
import { withoutOpener } from "./runtime";
import { validatePitchPayload } from "./pitch-validator";
import { venueDisplayName } from "@/lib/lineup/venue-display";
import { promoListIncludesHome } from "@/lib/lineup/venue-home-area";
import { promoNeighborhoodsWithHomeFirst } from "./quick-from-session";
import {
  fallbackMoodLine,
  headlinerFitLine,
  openerLocalLine,
} from "./pitch-catalog";

export function salvagePitch(
  session: AgentSessionState,
  input: LineupRequest,
): PitchPayload | null {
  const headliner = session.headlinerEntity;
  const home = session.pin?.homeNeighborhood;
  if (!headliner || session.neighborhoods.length < 2) return null;
  if (
    home &&
    !promoListIncludesHome(session.neighborhoods, home, session.pin?.city ?? "")
  ) {
    return null;
  }

  const pitch: PitchPayload = {
    venueLabel: venueDisplayName(input.concept),
    address: input.location,
    moodLine: fallbackMoodLine(session),
    headlinerWhy: headlinerFitLine(session),
    openerWhy:
      openerLocalLine(session) ??
      "No local opener stood out yet, so lock the headliner first.",
    crowdLine: session.crowdLine,
    headliner,
    opener: session.openerEntity ?? null,
    alternates: withoutOpener(session),
    neighborhoods: promoNeighborhoodsWithHomeFirst(session),
    evidenceFootnotes: { mode: "Salvaged from scout evidence." },
  };

  const validation = validatePitchPayload(pitch);
  if (!validation.ok) return null;
  return pitch;
}
