import {
  geocodeWithRetries,
  toSignalLocationPoint,
} from "@/lib/geocode/nominatim";
import { sanitizeForQloo, stripLikelyPersonalNames } from "@/lib/sanitize-for-qloo";
import { resolveMusicGenreTags } from "./genre-tags";
import type { VenuePin } from "./geography";
import type { LineupRequest } from "./schemas";

export type VenueSignals = {
  locationQuery: string;
  cityForHeatmap: string;
  regionState?: string;
  country?: string;
  signalLocationPoint?: string;
  locationMode: "point" | "query";
  venuePin?: VenuePin;
  musicTagIds: string[];
  tagIds: string[];
  tagLabels: string[];
  signalSummary: string;
};

export type ProvenanceRequest = {
  method: "GET";
  path: string;
  query: string;
};

export class GeocodeError extends Error {
  constructor() {
    super("Couldn't find that address. Try a street and city without the postcode.");
    this.name = "GeocodeError";
  }
}

function dedupeTagLabels(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name.trim());
  }
  return out;
}

export async function resolveVenueSignals(
  input: LineupRequest,
  requests: ProvenanceRequest[],
): Promise<VenueSignals> {
  const concept = sanitizeForQloo(stripLikelyPersonalNames(input.concept));
  const regulars = sanitizeForQloo(stripLikelyPersonalNames(input.regularsLove));
  const locationQuery = sanitizeForQloo(input.location);

  const geocode = await geocodeWithRetries(locationQuery);
  if (!geocode) {
    throw new GeocodeError();
  }

  const { ids: musicTagIds, labels: musicLabels } = await resolveMusicGenreTags(
    regulars,
    concept,
    requests,
  );

  const tagIds = [...musicTagIds];
  const tagLabels = dedupeTagLabels(musicLabels);

  const signalLocationPoint = toSignalLocationPoint(geocode.lon, geocode.lat);

  const signalSummary =
    tagLabels.length > 0
      ? tagLabels.slice(0, 4).join(" · ")
      : `${concept} crowd near ${locationQuery}`;

  const cityForHeatmap = geocode.cityForHeatmap;

  const venuePin: VenuePin = {
    lat: geocode.lat,
    lon: geocode.lon,
    city: cityForHeatmap,
    state: geocode.state,
    country: geocode.country,
    county: geocode.county,
    stateDistrict: geocode.stateDistrict,
  };

  return {
    locationQuery,
    cityForHeatmap,
    regionState: geocode.state,
    country: geocode.country,
    signalLocationPoint,
    locationMode: "point",
    venuePin,
    musicTagIds,
    tagIds,
    tagLabels,
    signalSummary,
  };
}
