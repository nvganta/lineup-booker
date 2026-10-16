import {
  isPromotableReverseGeocode,
  neighborhoodLabelFromReverse,
  reverseGeocodeNeighborhood,
} from "@/lib/geocode/nominatim";
import type { QlooHeatmapPoint } from "@/lib/qloo/types";
import {
  isNonPromotableNeighborhoodLabel,
  sameBoroughAsPin,
  type VenuePin,
} from "./geography";
import type { NeighborhoodCandidate } from "./heatmap-neighborhoods";

const RING_RADII_KM = [1.5, 2.25, 3] as const;
const POINTS_PER_RING = 8;
// Nominatim allows ~1 req/s, so an uncapped 24-point ring took ~26 s, ran out
// the agent's time and lookup budget, and pushed Quick mode past Vercel's 60 s.
const MAX_RING_LOOKUPS = 6;
const RING_DEADLINE_MS = 5_000;
const MAX_KM = 5;

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

function offsetPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number,
): { lat: number; lon: number } {
  const r = 6371;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceKm / r) +
      Math.cos(lat1) * Math.sin(distanceKm / r) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distanceKm / r) * Math.cos(lat1),
      Math.cos(distanceKm / r) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lon: (lon2 * 180) / Math.PI };
}

function affinityNear(
  grid: QlooHeatmapPoint[],
  lat: number,
  lon: number,
): number {
  let best = 0;
  for (const p of grid) {
    const plat = p.location?.latitude;
    const plon = p.location?.longitude;
    if (plat == null || plon == null) continue;
    const d = haversineKm(lat, lon, plat, plon);
    if (d > 2.5) continue;
    best = Math.max(best, p.query?.affinity ?? 0);
  }
  return best || 0.35;
}

/** Reverse-geocode a ring around the pin when heatmaps are thin. */
export async function collectRingNeighborhoodCandidates(
  pin: VenuePin,
  tagGrid: QlooHeatmapPoint[] = [],
): Promise<NeighborhoodCandidate[]> {
  const seen = new Set<string>();
  const out: NeighborhoodCandidate[] = [];
  const startedAt = Date.now();
  let lookups = 0;

  for (const radiusKm of RING_RADII_KM) {
    for (let i = 0; i < POINTS_PER_RING; i++) {
      if (out.length >= 5) break;
      if (lookups >= MAX_RING_LOOKUPS) return out;
      if (Date.now() - startedAt > RING_DEADLINE_MS) return out;
      const bearing = (360 / POINTS_PER_RING) * i;
      const { lat, lon } = offsetPoint(pin.lat, pin.lon, bearing, radiusKm);
      const dist = haversineKm(pin.lat, pin.lon, lat, lon);
      if (dist > MAX_KM) continue;

      let reverse;
      try {
        lookups++;
        ({ value: reverse } = await reverseGeocodeNeighborhood(lat, lon));
      } catch {
        // Lookup budget or time limit: keep what the ring already found.
        return out;
      }
      if (!reverse || !isPromotableReverseGeocode(reverse)) continue;
      if (!sameBoroughAsPin(pin, reverse.address)) continue;

      const rawLabel = neighborhoodLabelFromReverse(reverse);
      if (
        !rawLabel ||
        isNonPromotableNeighborhoodLabel(rawLabel, pin)
      ) {
        continue;
      }

      const key = rawLabel.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: rawLabel,
        score: affinityNear(tagGrid, lat, lon),
        source: "grid",
        distanceKm: dist,
        lat,
        lon,
        fallbackKind: "near_venue",
      });
    }
  }

  return out;
}

export type NeighborhoodResolveMeta = {
  usedTagHeatmap?: boolean;
  usedRingFallback?: boolean;
};
