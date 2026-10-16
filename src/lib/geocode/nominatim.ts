import {
  readPersistentCache,
  writePersistentCache,
} from "@/lib/geocode/nominatim-cache";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT =
  "LineupBooker/1.0 (Qloo Agentic Hackathon; https://github.com/)";

const MIN_INTERVAL_MS = 1100;
let lastNominatimAt = 0;
const memoryCache = new Map<string, unknown>();

export type ReverseGeocodeResult = {
  lat: number;
  lon: number;
  name: string;
  placeType: string;
  placeClass: string;
  adminLevel?: number;
  address?: NominatimAddress;
};

export type NominatimLookupResult<T> = {
  value: T | null;
  fromCache: boolean;
};

const PROMOTABLE_PLACE_TYPES = new Set([
  "suburb",
  "neighbourhood",
  "neighborhood",
  "quarter",
  "city_district",
  "borough",
  "residential",
  "district",
]);

const REJECT_PLACE_TYPES = new Set([
  "county",
  "state",
  "country",
  "region",
  "province",
  "city",
  "town",
  "municipality",
]);

export type PromotablePlaceContext = {
  adminLevel?: number;
  /** suburb / neighbourhood / quarter / city_district present on reverse hit */
  hasNeighborhoodAddress?: boolean;
};

function isNeighborhoodAdminLevel(level: number | undefined): boolean {
  return level === 9 || level === 10;
}

export function isPromotablePlaceType(
  placeType: string,
  placeClass: string,
  context?: PromotablePlaceContext,
): boolean {
  const t = placeType.trim().toLowerCase();
  const c = placeClass.trim().toLowerCase();
  if (REJECT_PLACE_TYPES.has(t)) return false;

  if (c === "boundary" && (t === "administrative" || t === "political")) {
    if (context?.hasNeighborhoodAddress) return true;
    if (isNeighborhoodAdminLevel(context?.adminLevel)) return true;
    return false;
  }

  if (t === "administrative") {
    if (context?.hasNeighborhoodAddress) return true;
    if (isNeighborhoodAdminLevel(context?.adminLevel)) return true;
    return false;
  }

  return PROMOTABLE_PLACE_TYPES.has(t);
}

export function isPromotableReverseGeocode(hit: ReverseGeocodeResult): boolean {
  const hasNeighborhoodAddress = neighborhoodLabelFromReverse(hit) !== null;
  return isPromotablePlaceType(hit.placeType, hit.placeClass, {
    adminLevel: hit.adminLevel,
    hasNeighborhoodAddress,
  });
}

export const REVERSE_GEOCODE_ZOOM = 14;

export function looksLikeStreetName(label: string): boolean {
  return /\b(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd|drive|dr\.?|lane|ln\.?|way|highway|hwy|close|crescent|court|ct\.?)\b/i.test(
    label,
  );
}

export function neighborhoodLabelFromReverse(
  hit: ReverseGeocodeResult,
): string | null {
  const addr = hit.address ?? {};
  const label =
    addr.suburb ??
    addr.neighbourhood ??
    addr.neighborhood ??
    addr.city_district ??
    addr.quarter;
  const trimmed = label?.trim();
  if (!trimmed || looksLikeStreetName(trimmed)) return null;
  return trimmed;
}

export type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  county?: string;
  state?: string;
  state_district?: string;
  country?: string;
  postcode?: string;
  city_district?: string;
  borough?: string;
  suburb?: string;
  neighbourhood?: string;
  neighborhood?: string;
  quarter?: string;
  road?: string;
  house_number?: string;
};

export type GeocodeResult = {
  lat: number;
  lon: number;
  displayName: string;
  cityForHeatmap: string;
  state?: string;
  country?: string;
  municipality?: string;
  county?: string;
  stateDistrict?: string;
  address?: NominatimAddress;
  /** Nominatim class/type, e.g. place/suburb or amenity/restaurant. */
  placeClass?: string;
  placeType?: string;
};

export function cityFromAddress(address: NominatimAddress): string | undefined {
  return (
    address.city ??
    address.city_district ??
    address.town ??
    address.village ??
    address.hamlet ??
    address.municipality ??
    address.suburb
  );
}

export function cityFromLocationText(location: string): string {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const maybeCity = parts[parts.length - 2]!;
    if (!/^\d/.test(maybeCity)) return maybeCity;
  }
  return parts[parts.length - 1] ?? location;
}

const UK_FULL_POSTCODE = /\b[A-Z]{1,2}\d[\dA-Z]?\s+\d[\dA-Z]{2}\b/gi;
const UK_OUTWARD_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\b/i;
const US_ZIP = /\b\d{5}(?:-\d{4})?\b/;

/** Remove full UK, trailing outward-only (e.g. EC2A), and US ZIP tokens. */
export function stripTrailingPostcodeToken(address: string): string {
  let s = address.trim();
  s = s.replace(UK_FULL_POSTCODE, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();

  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 0) {
    let last = parts[parts.length - 1]!;
    if (UK_OUTWARD_POSTCODE.test(last) && last.length <= 6) {
      parts.pop();
    } else if (US_ZIP.test(last)) {
      parts.pop();
    } else {
      last = last.replace(/\s+[A-Z]{1,2}\d[A-Z\d]?\s*$/i, "").trim();
      if (last) parts[parts.length - 1] = last;
    }
    s = parts.join(", ");
  }

  return s.replace(/,\s*$/, "").trim();
}

export type ParsedAddress = {
  street?: string;
  city?: string;
  country?: string;
};

export function parseAddressForGeocode(address: string): ParsedAddress {
  const cleaned = stripTrailingPostcodeToken(address);
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { street: parts[0] };
  if (parts.length === 2) {
    return { street: parts[0], city: parts[1] };
  }
  return {
    street: parts[0],
    city: parts[parts.length - 2],
    country: parts[parts.length - 1],
  };
}

/** Ordered free-text attempts for venue address geocoding. */
const US_STATE_ABBR =
  /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|BC|ON)$/i;

/** Mid-level place names in a typed address (e.g. Silver Lake), not street or state. */
export function neighborhoodHintsFromLocation(location: string): string[] {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  const hints: string[] = [];
  for (const part of parts) {
    if (/^\d/.test(part)) continue;
    if (US_STATE_ABBR.test(part)) continue;
    if (/^(usa|united states|u\.s\.a\.?)$/i.test(part)) continue;
    if (
      /\d/.test(part) &&
      /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|way|lane|ln)\b/i.test(
        part,
      )
    ) {
      continue;
    }
    hints.push(part);
  }
  return hints;
}

function houseNumberFromStreet(street?: string): string | undefined {
  if (!street) return undefined;
  const m = street.trim().match(/^(\d+[a-z]?)\b/i);
  return m?.[1]?.toLowerCase();
}

const STREET_ABBREVIATIONS: Record<string, string> = {
  st: "street",
  str: "street",
  ave: "avenue",
  av: "avenue",
  blvd: "boulevard",
  rd: "road",
  dr: "drive",
  ln: "lane",
  pl: "place",
  ct: "court",
  sq: "square",
  hwy: "highway",
  pkwy: "parkway",
  w: "west",
  e: "east",
  n: "north",
  s: "south",
};

/** "2801 Sunset Blvd" → ["sunset", "boulevard"]; directions are dropped so "W Queen St" matches "Queen Street West". */
export function streetNameTokens(street?: string): string[] {
  if (!street) return [];
  return street
    .toLowerCase()
    .replace(/^\s*\d+[a-z]?\b/, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((t) => STREET_ABBREVIATIONS[t] ?? t)
    .filter((t) => !["west", "east", "north", "south"].includes(t));
}

function placeFields(addr: NominatimAddress): string[] {
  return [
    addr.neighbourhood,
    addr.neighborhood,
    addr.quarter,
    addr.suburb,
    addr.city_district,
    addr.city,
    addr.town,
    addr.village,
  ]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.toLowerCase());
}

/**
 * Rank Nominatim candidates against what the owner typed. General rules only:
 * exact house number, same street name, same city, and every typed place hint
 * (neighbourhood, suburb, borough) that appears in the candidate's address.
 * Nominatim's own order breaks ties.
 */
export function scoreGeocodeResult(
  result: GeocodeResult,
  _typedAddress: string,
  parsed: ParsedAddress,
  hints: string[],
  rank = 0,
): number {
  let score = 0;
  const addr = result.address ?? {};
  const display = result.displayName.toLowerCase();

  const house = houseNumberFromStreet(parsed.street);
  if (house) {
    const hitHouse = addr.house_number?.toLowerCase();
    if (hitHouse === house) score += 120;
    else if (hitHouse) score -= 30; // a different building on the same street
  }

  const typedStreet = streetNameTokens(parsed.street);
  if (typedStreet.length) {
    const road = new Set(streetNameTokens(addr.road ?? ""));
    if (road.size && typedStreet.every((t) => road.has(t))) score += 40;
    else if (road.size) score -= 20;
  }

  const typedCity = parsed.city?.toLowerCase();
  const places = placeFields(addr);
  if (typedCity && places.length) {
    if (places.includes(typedCity)) score += 90;
    else if (display.includes(typedCity)) score += 35;
    else score -= 40;
  }

  for (const hint of hints) {
    const h = hint.toLowerCase();
    if (h.length < 3 || h === typedCity) continue;
    if (places.includes(h)) score += 70;
    else if (display.includes(h)) score += 45;
  }

  return score - rank * 2;
}

export function pickBestGeocodeResult(
  candidates: GeocodeResult[],
  typedAddress: string,
): GeocodeResult | null {
  if (candidates.length === 0) return null;
  const parsed = parseAddressForGeocode(typedAddress);
  const hints = neighborhoodHintsFromLocation(typedAddress);
  let best: GeocodeResult | null = null;
  let bestScore = -Infinity;
  candidates.forEach((c, rank) => {
    const s = scoreGeocodeResult(c, typedAddress, parsed, hints, rank);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  });
  return bestScore > 0 ? best : candidates[0] ?? null;
}

export function geocodeAddressAttempts(address: string): string[] {
  const trimmed = address.trim();
  const stripped = stripTrailingPostcodeToken(trimmed);
  const parsed = parseAddressForGeocode(trimmed);
  const attempts = [trimmed];
  if (stripped && stripped !== trimmed) attempts.push(stripped);
  if (parsed.street && parsed.city) {
    attempts.push(`${parsed.street}, ${parsed.city}`);
  }
  return [...new Set(attempts.filter(Boolean))];
}

function resultFromHit(hit: {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
  class?: string;
  type?: string;
}): GeocodeResult | null {
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (Number.isNaN(lon) || Number.isNaN(lat)) return null;

  const addr = hit.address ?? {};
  const cityForHeatmap =
    cityFromAddress(addr) ?? cityFromLocationText(hit.display_name);

  return {
    lat,
    lon,
    displayName: hit.display_name,
    cityForHeatmap,
    state: addr.state,
    country: addr.country,
    municipality: addr.municipality,
    county: addr.county,
    stateDistrict: addr.state_district,
    address: addr,
    placeClass: hit.class,
    placeType: hit.type,
  };
}

function cacheGet<T>(key: string): T | undefined {
  if (memoryCache.has(key)) return memoryCache.get(key) as T;
  const disk = readPersistentCache<T>(key);
  if (disk) memoryCache.set(key, disk);
  return disk;
}

function cacheSet<T>(key: string, value: T): void {
  memoryCache.set(key, value);
  writePersistentCache(key, value);
}

async function nominatimRequestMany(
  params: Record<string, string>,
  cacheKey: string,
  limit: number,
): Promise<NominatimLookupResult<GeocodeResult[]>> {
  const cached = cacheGet<GeocodeResult[]>(cacheKey);
  if (cached) return { value: cached, fromCache: true };

  const { getAgentRuntime } = await import("@/lib/agent/runtime");
  getAgentRuntime()?.budget.useNominatim();

  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastNominatimAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();

  const url = new URL(NOMINATIM_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(Math.max(1, limit)));

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });

  if (!response.ok) return { value: null, fromCache: false };

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: NominatimAddress;
  }>;

  const mapped = results
    .map((hit) => resultFromHit(hit))
    .filter((r): r is GeocodeResult => r != null);
  if (mapped.length === 0) return { value: null, fromCache: false };

  cacheSet(cacheKey, mapped);
  return { value: mapped, fromCache: false };
}

async function nominatimRequest(
  params: Record<string, string>,
  cacheKey: string,
): Promise<NominatimLookupResult<GeocodeResult>> {
  const cached = cacheGet<GeocodeResult>(cacheKey);
  if (cached) return { value: cached, fromCache: true };
  const { value: list } = await nominatimRequestMany(params, `${cacheKey}:list`, 1);
  const one = list?.[0] ?? null;
  if (one) cacheSet(cacheKey, one);
  return { value: one, fromCache: false };
}

async function nominatimFetchCandidates(
  query: string,
  limit: number,
): Promise<GeocodeResult[]> {
  const key = `q:${query.trim().toLowerCase()}:n${limit}`;
  const { value } = await nominatimRequestMany({ q: query }, key, limit);
  return value ?? [];
}

async function nominatimFetch(query: string): Promise<GeocodeResult | null> {
  const { value } = await nominatimRequest(
    { q: query },
    `q:${query.trim().toLowerCase()}`,
  );
  return value;
}

/** @internal tests */
export function clearNominatimMemoryCache(): void {
  memoryCache.clear();
}

async function nominatimStructured(params: {
  street: string;
  city: string;
  country?: string;
}): Promise<GeocodeResult | null> {
  const search: Record<string, string> = {
    street: params.street,
    city: params.city,
  };
  if (params.country) search.country = params.country;
  const cacheKey = `struct:${params.street}|${params.city}|${params.country ?? ""}`;
  const { value } = await nominatimRequest(search, cacheKey.toLowerCase());
  return value;
}

async function nominatimReverseRequest(
  lat: number,
  lon: number,
): Promise<NominatimLookupResult<ReverseGeocodeResult>> {
  const cacheKey = `rev:z${REVERSE_GEOCODE_ZOOM}:${lat.toFixed(5)}:${lon.toFixed(5)}`;
  const cached = cacheGet<ReverseGeocodeResult>(cacheKey);
  if (cached) return { value: cached, fromCache: true };

  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastNominatimAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();

  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", String(REVERSE_GEOCODE_ZOOM));

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });

  if (!response.ok) return { value: null, fromCache: false };

  const hit = (await response.json()) as {
    lat: string;
    lon: string;
    name?: string;
    type?: string;
    class?: string;
    address?: NominatimAddress;
    extratags?: { admin_level?: string };
  };

  if (!hit?.lat) return { value: null, fromCache: false };

  const adminRaw = hit.extratags?.admin_level;
  const adminLevel =
    adminRaw != null && adminRaw !== "" ? Number(adminRaw) : undefined;

  const result: ReverseGeocodeResult = {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    name: hit.name ?? "",
    placeType: hit.type ?? "",
    placeClass: hit.class ?? "",
    adminLevel: Number.isFinite(adminLevel) ? adminLevel : undefined,
    address: hit.address,
  };
  cacheSet(cacheKey, result);
  return { value: result, fromCache: false };
}

export async function reverseGeocodeNeighborhood(
  lat: number,
  lon: number,
): Promise<NominatimLookupResult<ReverseGeocodeResult>> {
  return nominatimReverseRequest(lat, lon);
}

export function viewboxAroundPin(
  lat: number,
  lon: number,
  radiusKm: number,
): string {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const left = lon - dLon;
  const right = lon + dLon;
  const top = lat + dLat;
  const bottom = lat - dLat;
  return `${left},${top},${right},${bottom}`;
}

async function nominatimFetchBounded(
  query: string,
  viewbox: string,
): Promise<GeocodeResult | null> {
  const { value } = await nominatimRequest(
    { q: query, viewbox, bounded: "1" },
    `b:${query.trim().toLowerCase()}|${viewbox}`,
  );
  return value;
}

export async function geocodeLocation(
  query: string,
): Promise<GeocodeResult | null> {
  return nominatimFetch(query);
}

export async function geocodeWithRetries(
  address: string,
): Promise<GeocodeResult | null> {
  for (const query of geocodeAddressAttempts(address)) {
    const candidates = await nominatimFetchCandidates(query, 8);
    const best = pickBestGeocodeResult(candidates, address);
    if (best) return best;
  }

  const parsed = parseAddressForGeocode(address);
  if (parsed.street && parsed.city) {
    const structured = await nominatimStructured({
      street: parsed.street,
      city: parsed.city,
      country: parsed.country,
    });
    if (structured) return structured;
  }

  return null;
}

export type LocalityGeocodePin = {
  lat: number;
  lon: number;
  city: string;
  state?: string;
  country?: string;
};

/** Geocode a neighbourhood name biased toward the venue pin (~6 km viewbox). */
/**
 * A neighbourhood lookup must land on an area, not a business that shares the
 * name ("Golden Horseshoe" → a barbecue restaurant) or an electoral riding.
 */
export function isAreaLikeHit(hit: GeocodeResult): boolean {
  const c = (hit.placeClass ?? "").toLowerCase();
  const t = (hit.placeType ?? "").toLowerCase();
  if (!c) return true;
  if (c === "place") return true;
  if (c === "boundary") return t === "administrative";
  if (c === "landuse") return t === "residential";
  return false;
}

export async function geocodeLocalityNearPin(
  localityName: string,
  pin: LocalityGeocodePin,
): Promise<GeocodeResult | null> {
  const cacheKey = `loc:${localityName.toLowerCase()}|${pin.city.toLowerCase()}|${pin.state ?? ""}|${pin.country ?? ""}`;
  const cached = cacheGet<GeocodeResult>(cacheKey);
  if (cached) return cached;

  const viewbox = viewboxAroundPin(pin.lat, pin.lon, 6);
  const queries = [
    `${localityName}, ${pin.city}`,
    `${localityName}, ${pin.city}, ${pin.state ?? ""}`.replace(/,\s*$/, ""),
    `${localityName}, ${pin.state ?? ""}, ${pin.country ?? ""}`.replace(
      /^,\s*|,\s*,/g,
      "",
    ),
  ].filter((q) => q.length > localityName.length + 2);

  for (const q of [...new Set(queries)]) {
    const hit = await nominatimFetchBounded(q, viewbox);
    if (hit && isAreaLikeHit(hit)) {
      cacheSet(cacheKey, hit);
      return hit;
    }
  }

  for (const q of [...new Set(queries)]) {
    const hit = await nominatimFetch(q);
    if (hit && isAreaLikeHit(hit)) {
      cacheSet(cacheKey, hit);
      return hit;
    }
  }

  return null;
}

/** @deprecated Use geocodeLocalityNearPin */
export async function geocodeLocalityName(
  name: string,
  state?: string,
  country?: string,
): Promise<GeocodeResult | null> {
  const parts = [name, state, country].filter(Boolean);
  return geocodeLocation(parts.join(", "));
}

/** WKT for Qloo: longitude first. */
export function toSignalLocationPoint(lon: number, lat: number): string {
  return `POINT(${lon} ${lat})`;
}
