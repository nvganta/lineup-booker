import { artistImageFromEntity, lookupArtistByName } from "@/lib/agent/lookup-artist";
import {
  markNeighbourhood,
  markOrigin,
  markRoomFit,
  type PlainAnswer,
  type PlainForm,
  type PlainResult,
} from "@/lib/compare/without-qloo";
import {
  displayCityLabelFromGeocode,
  geocodeLocation,
  geocodeWithRetries,
} from "@/lib/geocode/nominatim";
import { lookupArtistOrigin } from "@/lib/lineup/artist-origin-lookup";
import type { VenuePin } from "@/lib/lineup/geography";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";

/**
 * Checks the plain answer against real data. One Qloo call (the headliner's
 * search, which the response cache keeps for a week); the rest is Wikipedia,
 * MusicBrainz and OpenStreetMap.
 */
export async function checkPlainAnswer(
  answer: PlainAnswer,
  form: PlainForm,
): Promise<Omit<PlainResult, "modelId" | "answer">> {
  const out: Omit<PlainResult, "modelId" | "answer"> = {
    points: answer.neighbourhoods.map(() => null),
    marks: { headliner: [], opener: [], neighbourhoods: answer.neighbourhoods.map(() => null) },
  };

  const qloo = await lookupArtistByName(answer.headliner.name, []).catch(() => null);
  // Search falls back to the closest name; only an exact match says anything about this act.
  if (qloo && qloo.name.toLowerCase() === answer.headliner.name.toLowerCase()) {
    out.marks.headliner = markRoomFit(qloo.popularity, popularityBandFromConcept(form.concept));
    out.headlinerImageUrl = artistImageFromEntity(qloo);
  }

  const geo = await geocodeWithRetries(form.address).catch(() => null);
  if (!geo) return out;
  const pin: VenuePin = {
    lat: geo.lat,
    lon: geo.lon,
    city: geo.cityForHeatmap,
    displayCity: displayCityLabelFromGeocode(geo),
    state: geo.state,
    country: geo.country,
    county: geo.county,
    stateDistrict: geo.stateDistrict,
    borough: geo.address?.borough ?? geo.address?.city_district,
  };
  const [hOrigin, oOrigin] = await Promise.all([
    lookupArtistOrigin(answer.headliner.name, undefined, 2500),
    answer.opener ? lookupArtistOrigin(answer.opener.name, undefined, 2500) : Promise.resolve(undefined),
  ]);
  out.marks.headliner = [...markOrigin(answer.headliner, hOrigin, pin), ...out.marks.headliner];
  if (answer.opener) out.marks.opener = markOrigin(answer.opener, oOrigin, pin, true);

  const city = pin.displayCity || pin.city;
  // Nominatim asks for one request a second, so these stay sequential.
  for (const [i, n] of answer.neighbourhoods.entries()) {
    const g = await geocodeLocation(`${n}, ${city}`).catch(() => null);
    out.marks.neighbourhoods[i] = markNeighbourhood(g, pin);
    if (g) out.points[i] = { lat: g.lat, lon: g.lon };
  }
  return out;
}
