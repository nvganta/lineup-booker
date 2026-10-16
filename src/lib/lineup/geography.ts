import {
  cityFromAddress,
  geocodeLocalityNearPin,
  reverseGeocodeNeighborhood,
  type GeocodeResult,
} from "@/lib/geocode/nominatim";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import type { QlooEntity } from "@/lib/qloo/types";

export type VenuePin = {
  lat: number;
  lon: number;
  city: string;
  state?: string;
  country?: string;
  county?: string;
  stateDistrict?: string;
  suburb?: string;
  borough?: string;
  city_district?: string;
  /** Neighbourhood at the venue pin (reverse geocode or geocoder suburb). */
  homeNeighborhood?: string;
};

const NYC_COUNTY_TO_BOROUGH: Record<string, string> = {
  "kings county": "brooklyn",
  "new york county": "manhattan",
  "queens county": "queens",
  "bronx county": "bronx",
  "richmond county": "staten island",
};

export type LocalityRow = QlooEntity & {
  properties?: QlooEntity["properties"] & { boundary?: string };
};

export type LocalityAudit = {
  name: string;
  affinity?: number;
  distanceKm: number | null;
  lat?: number;
  lon?: number;
  sameCity: boolean;
  kept: boolean;
  reason: string;
};

const MAX_KM = 5;
const HEATMAP_TRIM = 15;
export const LOCALITY_NOMINATIM_CAP = 8;
const TARGET_KEPT_LOCALITIES = 5;

const US_STATE_NAMES = new Set(
  [
    "alabama",
    "alaska",
    "arizona",
    "arkansas",
    "california",
    "colorado",
    "connecticut",
    "delaware",
    "florida",
    "georgia",
    "hawaii",
    "idaho",
    "illinois",
    "indiana",
    "iowa",
    "kansas",
    "kentucky",
    "louisiana",
    "maine",
    "maryland",
    "massachusetts",
    "michigan",
    "minnesota",
    "mississippi",
    "missouri",
    "montana",
    "nebraska",
    "nevada",
    "new hampshire",
    "new jersey",
    "new mexico",
    "new york",
    "north carolina",
    "north dakota",
    "ohio",
    "oklahoma",
    "oregon",
    "pennsylvania",
    "rhode island",
    "south carolina",
    "south dakota",
    "tennessee",
    "texas",
    "utah",
    "vermont",
    "virginia",
    "washington",
    "west virginia",
    "wisconsin",
    "wyoming",
  ],
);

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function centroidFromWkt(wkt: string): { lat: number; lon: number } | null {
  const nums = wkt.match(/-?\d+\.?\d*/g);
  if (!nums || nums.length < 2) return null;

  const coords: Array<{ lon: number; lat: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const lon = Number(nums[i]);
    const lat = Number(nums[i + 1]);
    if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
      coords.push({ lon, lat });
    }
  }
  if (coords.length === 0) return null;

  const lon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  return { lat, lon };
}

export function normalizeCityLabel(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/\bec\d[a-z]\d?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse geocoder variants (Greater London → london, City of Vancouver → vancouver). */
export function canonicalCityLabel(city: string): string {
  let n = normalizeCityLabel(city);
  n = n.replace(/^city of\s+/, "");
  if (n.startsWith("greater ")) {
    n = n.slice("greater ".length).trim();
  }
  return n;
}

export function cityLabelsEquivalent(a: string, b: string): boolean {
  return canonicalCityLabel(a) === canonicalCityLabel(b);
}

export function isStatisticalRegionLabel(name: string): boolean {
  const trimmed = name.trim();
  const n = trimmed.toLowerCase();
  if (/^inner london\b/.test(n)) return true;
  if (/^outer london\b/.test(n)) return true;
  if (/\s-\s/.test(trimmed)) {
    if (/^(inner|outer|north|south|east|west|central|metropolitan)\s+/i.test(trimmed)) {
      return true;
    }
  }
  return false;
}

export function isAdminDivisionName(
  name: string,
  disambiguation?: string,
): boolean {
  const n = name.trim().toLowerCase();
  const parts = (disambiguation ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length >= 2 && parts[0] === n) {
    const parent = parts[1] ?? "";
    if (
      parent === "england" ||
      parent === "scotland" ||
      parent === "wales" ||
      parent === "canada" ||
      parent === "united kingdom" ||
      parent === "united states" ||
      parent.includes("united states of america")
    ) {
      return true;
    }
  }
  return false;
}

export function isBroadRegion(name: string, disambiguation?: string): boolean {
  const n = name.trim().toLowerCase();
  const d = (disambiguation ?? "").trim().toLowerCase();
  if (isStatisticalRegionLabel(name)) return true;
  if (isAdminDivisionName(name, disambiguation)) return true;
  if (US_STATE_NAMES.has(n)) return true;
  const blocked = [
    "canada",
    "united states",
    "united states of america",
    "united kingdom",
    "great britain",
    "england",
    "scotland",
    "wales",
    "morocco",
    "british columbia",
    "ontario",
    "california",
    "texas",
    "southern california",
    "inner london",
    "outer london",
    "electoral area a",
  ];
  if (blocked.includes(n)) return true;
  if (n.startsWith("metro ") || n.startsWith("greater ")) return true;
  if (n.includes("contiguous") || n.includes("four corners")) return true;
  if (/\bcounty\b/.test(n) || /\bcounty\b/.test(d)) return true;
  if (/\bborough of\b/.test(n)) return true;
  if (d === "canada" || d === "united states" || d === "united kingdom") {
    return true;
  }
  return false;
}

function localityCityFromGeocode(hit: GeocodeResult): string {
  const addr = hit.address ?? {};
  return (
    cityFromAddress(addr) ??
    hit.cityForHeatmap ??
    hit.municipality ??
    ""
  );
}

/** Same city or shared county / state_district (e.g. Greater London boroughs). */
export function sameLocalityArea(
  venue: VenuePin,
  localityGeocode: GeocodeResult,
): boolean {
  const venueCity = canonicalCityLabel(venue.city);
  const locCity = canonicalCityLabel(localityCityFromGeocode(localityGeocode));

  if (locCity && venueCity) {
    if (locCity === venueCity) return true;
    if (locCity.includes(venueCity) || venueCity.includes(locCity)) return true;
  }

  const venueDistrict = canonicalCityLabel(
    venue.stateDistrict ?? venue.county ?? "",
  );
  const locDistrict = canonicalCityLabel(
    localityGeocode.stateDistrict ??
      localityGeocode.county ??
      localityGeocode.address?.state_district ??
      localityGeocode.address?.county ??
      "",
  );

  if (venueDistrict && locDistrict && venueDistrict === locDistrict) {
    return true;
  }

  return false;
}

/** Admin units above neighbourhood level (no hardcoded city lists). */
export function isMacroAdminNeighborhoodName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (/\bcounty\b/.test(n)) return true;
  if (/^metro |^greater /i.test(name.trim())) return true;
  if (/^city of\b/.test(n)) return true;
  if (/\sisland$/i.test(n.trim()) && !/\b(university|rhode)\b/i.test(n)) {
    return true;
  }
  if (isStatisticalRegionLabel(name)) return true;
  if (isAdminDivisionName(name)) return true;
  return false;
}

/** @deprecated use isMacroAdminNeighborhoodName */
export function isBoroughOrRegionLabel(name: string): boolean {
  return isMacroAdminNeighborhoodName(name);
}

function boroughFromCounty(county?: string): string | undefined {
  if (!county) return undefined;
  return NYC_COUNTY_TO_BOROUGH[county.trim().toLowerCase()];
}

/** Best-effort NYC / metro borough for comparing fan-heat rows to the venue pin. */
function normalizeBorough(raw: string | undefined, city: string | undefined): string | undefined {
  if (!raw) return undefined;
  const fromCounty = boroughFromCounty(raw);
  if (fromCounty) return fromCounty;
  const n = canonicalCityLabel(raw);
  if (!n || (city && n === canonicalCityLabel(city))) return undefined;
  return n;
}

/**
 * Borough-level area for the pin (NYC borough, London borough, city district).
 * Suburb and neighbourhood are deliberately not used: two different
 * neighbourhoods are not two different boroughs.
 */
export function promotionBoroughForPin(pin: VenuePin): string | undefined {
  return (
    normalizeBorough(pin.borough, pin.city) ??
    normalizeBorough(pin.county && boroughFromCounty(pin.county) ? pin.county : undefined, pin.city) ??
    normalizeBorough(pin.city_district, pin.city)
  );
}

function promotionBoroughFromGeocode(hit: GeocodeResult): string | undefined {
  const addr = hit.address ?? {};
  const city = addr.city ?? hit.cityForHeatmap;
  return (
    normalizeBorough(addr.borough, city) ??
    normalizeBorough(addr.city_district, city) ??
    normalizeBorough(
      hit.county && boroughFromCounty(hit.county) ? hit.county : undefined,
      city,
    )
  );
}

export function samePromotableLocalityArea(
  pin: VenuePin,
  localityGeocode: GeocodeResult,
): boolean {
  if (!sameLocalityArea(pin, localityGeocode)) return false;
  const venueBorough = promotionBoroughForPin(pin);
  const locBorough = promotionBoroughFromGeocode(localityGeocode);
  if (venueBorough && locBorough && venueBorough !== locBorough) {
    return false;
  }
  return true;
}

/** Reverse-geocoded heatmap cells get the same borough check as locality rows. */
export function sameBoroughAsPin(
  pin: VenuePin,
  address: GeocodeResult["address"] | undefined,
): boolean {
  if (!address) return true;
  const venueBorough = promotionBoroughForPin(pin);
  if (!venueBorough) return true;
  const cellBorough = promotionBoroughFromGeocode({
    address,
    county: address.county,
  } as GeocodeResult);
  return !cellBorough || cellBorough === venueBorough;
}

export function isVenueCityName(name: string, pin: VenuePin): boolean {
  return cityLabelsEquivalent(name, pin.city);
}

/** Housing estates, city borough rows, and other non-neighbourhood locality labels. */
export function isNonPromotableNeighborhoodLabel(
  name: string,
  pin: VenuePin,
  disambiguation?: string,
): boolean {
  if (isBroadRegion(name, disambiguation)) return true;
  if (isMacroAdminNeighborhoodName(name)) return true;
  if (isVenueCityName(name, pin)) return true;
  if (
    /\s+centre$/i.test(name.trim()) &&
    !/^city centre$/i.test(name.trim())
  ) {
    return true;
  }
  if (/\belectoral\b/i.test(disambiguation ?? "")) return true;
  // The venue's own borough ("Brooklyn") is too broad to poster.
  const venueBorough = promotionBoroughForPin(pin);
  if (venueBorough && normalizeBorough(name, pin.city) === venueBorough) {
    return true;
  }

  const n = name.trim().toLowerCase();
  if (/^city of\b/.test(n)) return true;
  if (/\bestates?\b/.test(n) && !n.includes("united states")) return true;
  if (n === "westminster" || n.includes("city of westminster")) return true;

  return false;
}

export function displayNeighborhoodName(name: string, venueCity: string): string {
  // OSM names some areas by their civic body ("Los Feliz Neighborhood
  // Council District"); the poster needs the place name.
  const stripped = stripCityFromNeighborhoodLabel(name, venueCity).replace(
    /\s+(neighbou?rhood council(\s+district)?|community board(\s+\d+)?)$/i,
    "",
  );
  if (stripped.trim().toLowerCase() === "downtown") {
    return "Downtown";
  }
  return stripped;
}

function dedupeLocalities(entities: LocalityRow[]): LocalityRow[] {
  const byName = new Map<string, LocalityRow>();
  for (const entity of entities) {
    const key = entity.name.trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev || (entity.query?.affinity ?? 0) > (prev.query?.affinity ?? 0)) {
      byName.set(key, entity);
    }
  }
  return [...byName.values()].sort(
    (a, b) => (b.query?.affinity ?? 0) - (a.query?.affinity ?? 0),
  );
}

export function trimHeatmapLocalities(entities: LocalityRow[]): LocalityRow[] {
  return dedupeLocalities(entities).slice(0, HEATMAP_TRIM);
}

type LocalityPoint = {
  lat: number;
  lon: number;
  geocode?: GeocodeResult;
};

async function localityPoint(
  entity: LocalityRow,
  pin: VenuePin,
): Promise<{ point: LocalityPoint | null; nominatimNetwork: boolean }> {
  const boundary = entity.properties?.boundary;
  if (boundary) {
    const c = centroidFromWkt(boundary);
    if (c) return { point: { lat: c.lat, lon: c.lon }, nominatimNetwork: false };
  }

  const hit = await geocodeLocalityNearPin(entity.name, pin);
  if (!hit) return { point: null, nominatimNetwork: true };

  return {
    point: { lat: hit.lat, lon: hit.lon, geocode: hit },
    nominatimNetwork: true,
  };
}

export async function filterNeighborhoodLocalities(
  entities: LocalityRow[],
  pin: VenuePin,
  /** Stop geocoding after this time (ms epoch); Nominatim is ~1 req/s. */
  stopAt = Number.POSITIVE_INFINITY,
): Promise<{
  kept: LocalityRow[];
  audit: LocalityAudit[];
}> {
  const audit: LocalityAudit[] = [];
  const kept: LocalityRow[] = [];
  const trimmed = trimHeatmapLocalities(entities).slice(
    0,
    LOCALITY_NOMINATIM_CAP,
  );

  for (const entity of trimmed) {
    if (kept.length >= TARGET_KEPT_LOCALITIES) break;
    if (Date.now() > stopAt) break;

    const name = entity.name;
    const affinity = entity.query?.affinity;

    if (isNonPromotableNeighborhoodLabel(name, pin, entity.disambiguation)) {
      audit.push({
        name,
        affinity,
        distanceKm: null,
        sameCity: false,
        kept: false,
        reason: "non-promotable neighbourhood label",
      });
      continue;
    }

    let located: Awaited<ReturnType<typeof localityPoint>>;
    try {
      located = await localityPoint(entity, pin);
    } catch {
      // Lookup budget or time limit: keep the areas already confirmed.
      break;
    }
    const { point } = located;

    if (!point) {
      audit.push({
        name,
        affinity,
        distanceKm: null,
        sameCity: false,
        kept: false,
        reason: "no geometry or geocode",
      });
      continue;
    }

    const distanceKm = haversineKm(
      pin.lat,
      pin.lon,
      point.lat,
      point.lon,
    );

    if (distanceKm > MAX_KM) {
      audit.push({
        name,
        affinity,
        distanceKm,
        sameCity: false,
        kept: false,
        reason: `>${MAX_KM} km from pin`,
      });
      continue;
    }

    // Qloo boundary centroids skip geocoding; in a city with boroughs, check
    // the centroid's borough so a Brooklyn room doesn't promote in Manhattan.
    let sameCity = point.geocode
      ? samePromotableLocalityArea(pin, point.geocode)
      : true;
    // Only true NYC boroughs: each check costs a Nominatim call from the
    // agent's 20-call budget, and an exhausted budget drops every area.
    const venueBorough = promotionBoroughForPin(pin);
    if (sameCity && !point.geocode && venueBorough) {
      try {
        const { value: reverse } = await reverseGeocodeNeighborhood(
          point.lat,
          point.lon,
        );
        sameCity = sameBoroughAsPin(pin, reverse?.address);
      } catch {
        // Budget or network: keep the row rather than lose the area.
      }
    }

    if (!sameCity) {
      audit.push({
        name,
        affinity,
        distanceKm,
        sameCity: false,
        kept: false,
        reason: point.geocode
          ? "geocoded outside venue area"
          : "geocoded outside venue area",
      });
      continue;
    }

    audit.push({
      name,
      affinity,
      distanceKm,
      lat: point.lat,
      lon: point.lon,
      sameCity: true,
      kept: true,
      reason: "within radius and venue area",
    });
    kept.push(entity);
  }

  kept.sort((a, b) => {
    const affinityDiff =
      (b.query?.affinity ?? 0) - (a.query?.affinity ?? 0);
    if (affinityDiff !== 0) return affinityDiff;
    return a.name.localeCompare(b.name);
  });

  return { kept, audit };
}
