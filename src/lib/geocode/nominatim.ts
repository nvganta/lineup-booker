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
  suburb?: string;
  neighbourhood?: string;
  neighborhood?: string;
  quarter?: string;
  road?: string;
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

async function nominatimRequest(
  params: Record<string, string>,
  cacheKey: string,
): Promise<NominatimLookupResult<GeocodeResult>> {
  const cached = cacheGet<GeocodeResult>(cacheKey);
  if (cached) return { value: cached, fromCache: true };

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
  url.searchParams.set("limit", "1");

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

  const hit = results[0];
  if (!hit) return { value: null, fromCache: false };

  const result = resultFromHit(hit);
  if (result) cacheSet(cacheKey, result);
  return { value: result, fromCache: false };
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
    const hit = await geocodeLocation(query);
    if (hit) return hit;
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
    if (hit) {
      cacheSet(cacheKey, hit);
      return hit;
    }
  }

  for (const q of [...new Set(queries)]) {
    const hit = await nominatimFetch(q);
    if (hit) {
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
