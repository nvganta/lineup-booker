import type { AgentSessionState, PitchPayload } from "./types";
import type { LineupRequest } from "@/lib/lineup/schemas";
import type { GeocodeResult } from "@/lib/geocode/nominatim";
import { displayCityLabelFromGeocode } from "@/lib/geocode/nominatim";
import { buildOpenerOriginByActId } from "@/lib/lineup/opener-origin-meta";
import { buildOpenerPickLinesByActId } from "@/lib/lineup/opener-pick-copy";

export function cityLabelFromPin(
  pin: AgentSessionState["pin"],
): string {
  if (!pin) return "";
  return pin.displayCity?.trim() || pin.city?.trim() || "";
}

export function buildPitchMetaFromSession(
  session: AgentSessionState,
  input: LineupRequest,
): NonNullable<PitchPayload["meta"]> {
  const cityLabel = cityLabelFromPin(session.pin);
  const originByAct = buildOpenerOriginByActId(session);
  const openerId = session.openerEntity?.id;
  return {
    cityQuery: session.pin?.city ?? cityLabel,
    countryQuery:
      session.pin?.country?.trim() ||
      session.pin?.state?.trim() ||
      "Canada",
    cityLabel,
    concept: input.concept,
    regularsLove: input.regularsLove,
    musicTagIds: [...session.tagIds],
    openerOriginByActId: originByAct,
    openerOriginMatchesCity:
      openerId != null ? originByAct[openerId] === true : false,
    headlinerPoolSize: session.headlinerPoolSize,
    headlinerRankInPool: session.headlinerRankInPool,
    headlinerPopularity: session.headlinerEntity?.popularity,
    openerPopularity: session.openerEntity?.popularity,
    tagLabels: [...session.tagLabels],
    openerPickLinesByActId: buildOpenerPickLinesByActId(session),
  };
}

export function displayCityForGeocode(hit: GeocodeResult): string {
  return displayCityLabelFromGeocode(hit);
}
