import {
  isPromotableReverseGeocode,
  neighborhoodLabelFromReverse,
  reverseGeocodeNeighborhood,
} from "@/lib/geocode/nominatim";
import type { QlooHeatmapPoint } from "@/lib/qloo/types";
import {
  displayNeighborhoodName,
  isNonPromotableNeighborhoodLabel,
  sameBoroughAsPin,
  type VenuePin,
} from "./geography";
import type { PromoteNeighborhood } from "./neighborhoods";

const MAX_KM = 5;
export const TOP_GRID_CELLS = 8;
export const TARGET_NEIGHBORHOODS = 5;

export type NeighborhoodCandidate = {
  name: string;
  score: number;
  source: "grid" | "locality";
  distanceKm?: number;
  lat?: number;
  lon?: number;
  /** Honest label when not from the primary artist heatmap row. */
  fallbackKind?: "tag_heatmap" | "near_venue";
};

export function neighborhoodRankingScore(candidate: NeighborhoodCandidate): number {
  const affinity = candidate.score;
  const d = candidate.distanceKm ?? 0;
  const proximity = Math.max(0.12, 1 - d / MAX_KM);
  return affinity * proximity;
}

export type GridNeighborhoodAudit = {
  lat: number;
  lon: number;
  affinity: number;
  label?: string;
  kept: boolean;
  reason: string;
};

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

export function rankHeatmapCells(
  grid: QlooHeatmapPoint[],
  pin: VenuePin,
): Array<{ lat: number; lon: number; affinity: number }> {
  return grid
    .map((point) => {
      const lat = point.location?.latitude;
      const lon = point.location?.longitude;
      if (lat == null || lon == null) return null;
      return {
        lat,
        lon,
        affinity: point.query?.affinity ?? 0,
      };
    })
    .filter((c): c is { lat: number; lon: number; affinity: number } => !!c)
    .filter((c) => haversineKm(pin.lat, pin.lon, c.lat, c.lon) <= MAX_KM)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, TOP_GRID_CELLS);
}

export async function collectGridNeighborhoodCandidates(
  grid: QlooHeatmapPoint[],
  pin: VenuePin,
  stopAt = Number.POSITIVE_INFINITY,
): Promise<{ candidates: NeighborhoodCandidate[]; audit: GridNeighborhoodAudit[] }> {
  const audit: GridNeighborhoodAudit[] = [];
  const cells = rankHeatmapCells(grid, pin);
  const seenLabels = new Set<string>();
  const reverseByRoundedCell = new Map<
    string,
    Awaited<ReturnType<typeof reverseGeocodeNeighborhood>>
  >();
  const candidates: NeighborhoodCandidate[] = [];

  for (const cell of cells) {
    if (candidates.length >= TARGET_NEIGHBORHOODS) break;
    if (Date.now() > stopAt) break;

    const cellDistanceKm = haversineKm(
      pin.lat,
      pin.lon,
      cell.lat,
      cell.lon,
    );

    const reverseKey = `${cell.lat.toFixed(3)}:${cell.lon.toFixed(3)}`;
    let reverseLookup = reverseByRoundedCell.get(reverseKey);
    if (!reverseLookup) {
      try {
        reverseLookup = await reverseGeocodeNeighborhood(cell.lat, cell.lon);
      } catch {
        break;
      }
      reverseByRoundedCell.set(reverseKey, reverseLookup);
    }
    const { value: reverse } = reverseLookup;

    if (!reverse) {
      audit.push({
        lat: cell.lat,
        lon: cell.lon,
        affinity: cell.affinity,
        kept: false,
        reason: "reverse geocode failed",
      });
      continue;
    }

    if (!isPromotableReverseGeocode(reverse)) {
      audit.push({
        lat: cell.lat,
        lon: cell.lon,
        affinity: cell.affinity,
        label: reverse.name,
        kept: false,
        reason: `place type ${reverse.placeType}`,
      });
      continue;
    }

    const rawLabel = neighborhoodLabelFromReverse(reverse);
    if (
      !rawLabel ||
      isNonPromotableNeighborhoodLabel(rawLabel, pin)
    ) {
      audit.push({
        lat: cell.lat,
        lon: cell.lon,
        affinity: cell.affinity,
        label: rawLabel ?? undefined,
        kept: false,
        reason: "not a promotable neighbourhood label",
      });
      continue;
    }

    if (!sameBoroughAsPin(pin, reverse.address)) {
      audit.push({
        lat: cell.lat,
        lon: cell.lon,
        affinity: cell.affinity,
        label: rawLabel,
        kept: false,
        reason: "different borough from venue",
      });
      continue;
    }

    const key = rawLabel.trim().toLowerCase();
    if (seenLabels.has(key)) {
      audit.push({
        lat: cell.lat,
        lon: cell.lon,
        affinity: cell.affinity,
        label: rawLabel,
        kept: false,
        reason: "duplicate label",
      });
      continue;
    }

    seenLabels.add(key);
    candidates.push({
      name: rawLabel,
      score: cell.affinity,
      source: "grid",
      distanceKm: cellDistanceKm,
      lat: cell.lat,
      lon: cell.lon,
    });
    audit.push({
      lat: cell.lat,
      lon: cell.lon,
      affinity: cell.affinity,
      label: rawLabel,
      kept: true,
      reason: "heatmap cell",
    });
  }

  return { candidates, audit };
}

function normalizeNeighborhoodKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u2013\u2014-]/g, "-");
}

/** Drop "University" when "University–Rosedale" is already kept (name containment). */
function dedupeContainedNames(
  candidates: NeighborhoodCandidate[],
): NeighborhoodCandidate[] {
  const sorted = [...candidates].sort(
    (a, b) => neighborhoodRankingScore(b) - neighborhoodRankingScore(a),
  );
  const kept: NeighborhoodCandidate[] = [];
  for (const c of sorted) {
    const key = normalizeNeighborhoodKey(c.name);
    const dominatedIdx = kept.findIndex((k) => {
      const kk = normalizeNeighborhoodKey(k.name);
      return kk !== key && (kk.includes(key) || key.includes(kk));
    });
    if (dominatedIdx >= 0) {
      const dominated = kept[dominatedIdx]!;
      if (neighborhoodRankingScore(c) > neighborhoodRankingScore(dominated)) {
        kept[dominatedIdx] = c;
      }
      continue;
    }
    kept.push(c);
  }
  return kept;
}

export function mergeNeighborhoodCandidates(
  parts: NeighborhoodCandidate[],
): NeighborhoodCandidate[] {
  const byName = new Map<string, NeighborhoodCandidate>();
  for (const candidate of parts) {
    const key = candidate.name.trim().toLowerCase();
    const prev = byName.get(key);
    if (
      !prev ||
      neighborhoodRankingScore(candidate) > neighborhoodRankingScore(prev)
    ) {
      byName.set(key, candidate);
    }
  }
  return dedupeContainedNames([...byName.values()]).sort((a, b) => {
    const scoreDiff = neighborhoodRankingScore(b) - neighborhoodRankingScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
  });
}

// The card shows plain place names; where a fallback area came from is
// explained once in the scouting log ("How I got here"), not per pin.
function labelWithProvenance(
  row: NeighborhoodCandidate,
  venueCity: string,
): string {
  return displayNeighborhoodName(row.name, venueCity);
}

export function candidatesToPromoteList(
  merged: NeighborhoodCandidate[],
  venueCity: string,
): PromoteNeighborhood[] {
  return merged.slice(0, TARGET_NEIGHBORHOODS).map((row, index) => ({
    name: labelWithProvenance(row, venueCity),
    rank: index + 1,
    lat: row.lat,
    lon: row.lon,
  }));
}

/** @deprecated use collectGridNeighborhoodCandidates + merge */
export async function neighborhoodsFromHeatmapGrid(
  grid: QlooHeatmapPoint[],
  pin: VenuePin,
): Promise<{ neighborhoods: PromoteNeighborhood[]; audit: GridNeighborhoodAudit[] }> {
  const { candidates, audit } = await collectGridNeighborhoodCandidates(
    grid,
    pin,
  );
  const neighborhoods = candidatesToPromoteList(candidates, pin.city);
  return { neighborhoods, audit };
}
