import type { LineupRequest } from "@/lib/lineup/schemas";
import type { AgentSessionState, PitchPayload, StreamWriter } from "./types";
import { applyArtistBackgroundsToPitch } from "./research/apply-pitch";
import {
  flushArtistResearch,
  researchSourceFootnotes,
} from "./research/scheduler";
import { RESEARCH_TOTAL_MS } from "./research/types";
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

/** Write a salvage pitch + summary when scout/opener steps fail mid-stream. */
export async function emitSalvagedPitchIfReady(
  session: AgentSessionState,
  input: LineupRequest,
  writer: StreamWriter,
  stats: { elapsedSec: number; qlooLookups: number; retries: number },
): Promise<boolean> {
  if (session.pitch) return true;
  await flushArtistResearch(session, RESEARCH_TOTAL_MS);
  let salvaged = salvagePitch(session, input);
  if (!salvaged) return false;
  const backgrounds = session.artistBackgrounds ?? {};
  salvaged = applyArtistBackgroundsToPitch(salvaged, backgrounds);
  salvaged = {
    ...salvaged,
    evidenceFootnotes: {
      ...salvaged.evidenceFootnotes,
      ...researchSourceFootnotes(backgrounds),
    },
  };
  session.pitch = salvaged;
  writer.writePitch(salvaged);
  writer.writeStep({
    id: crypto.randomUUID(),
    kind: "pitch",
    status: "done",
    label: "Wrapped up with the scout's picks.",
    why: "The scout hit an error, so this pitch uses plain copy from what was already found.",
  });
  writer.writeSummary({
    elapsedSec: stats.elapsedSec,
    qlooLookups: stats.qlooLookups,
    retries: stats.retries,
    quickMode: false,
  });
  return true;
}
