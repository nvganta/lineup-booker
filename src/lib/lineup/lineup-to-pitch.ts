import type { PitchPayload } from "@/lib/agent/types";
import type { LineupResult } from "./build-lineup";
import type { LineupRequest } from "./schemas";

function countryFromLocation(location: string): string {
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (/canada/i.test(last) || /^(BC|ON|AB)$/i.test(last)) return "Canada";
  if (/united states|usa/i.test(last)) return "United States";
  return last || "Canada";
}

/** Map deterministic pipeline result to poster payload (no invented copy). */
export function lineupResultToPitch(
  lineup: LineupResult,
  request: LineupRequest,
): PitchPayload {
  const cityLabel =
    lineup.venue?.displayCity?.trim() || lineup.venue?.city?.trim() || "";
  return {
    venueLabel: lineup.venueLabel,
    address: request.location,
    moodLine: lineup.eventLabel,
    headlinerWhy: "",
    openerWhy: "",
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
    neighborhoods: lineup.neighborhoods,
    openerSwapQueue: lineup.openerSwapQueue,
    crowdDemographics: lineup.crowdDemographics ?? null,
    evidenceFootnotes: {},
    meta: lineup.pitchMeta ?? {
      cityQuery: cityLabel,
      countryQuery: countryFromLocation(request.location),
      cityLabel,
      concept: request.concept,
      regularsLove: request.regularsLove,
      musicTagIds: [],
    },
  };
}
