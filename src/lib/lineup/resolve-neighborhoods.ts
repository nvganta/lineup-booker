import { getCached, setCached } from "@/lib/qloo/cache";
import type { QlooHeatmapPoint } from "@/lib/qloo/types";
import {
  filterNeighborhoodLocalities,
  trimHeatmapLocalities,
  type LocalityAudit,
  type LocalityRow,
  type VenuePin,
} from "./geography";
import {
  candidatesToPromoteList,
  collectGridNeighborhoodCandidates,
  mergeNeighborhoodCandidates,
  type NeighborhoodCandidate,
} from "./heatmap-neighborhoods";
import type { PromoteNeighborhood } from "./neighborhoods";

export function buildMergedNeighborhoodCandidates(
  gridCandidates: NeighborhoodCandidate[],
  localityKept: LocalityRow[],
  localityAudit: LocalityAudit[],
): NeighborhoodCandidate[] {
  const distanceByName = new Map(
    localityAudit.map((row) => [row.name, row.distanceKm ?? undefined]),
  );

  const localityCandidates: NeighborhoodCandidate[] = localityKept.map(
    (entity) => ({
      name: entity.name,
      score: entity.query?.affinity ?? 0,
      source: "locality",
      distanceKm: distanceByName.get(entity.name),
    }),
  );

  return mergeNeighborhoodCandidates([
    ...gridCandidates,
    ...localityCandidates,
  ]);
}

export async function resolvePromoteNeighborhoods(
  cacheKey: string,
  grid: QlooHeatmapPoint[],
  localityRows: LocalityRow[],
  pin: VenuePin,
): Promise<PromoteNeighborhood[]> {
  const cached = getCached<PromoteNeighborhood[]>(cacheKey);
  if (cached) return cached;

  const [{ candidates: gridCandidates }, localityFilter] = await Promise.all([
    collectGridNeighborhoodCandidates(grid, pin),
    filterNeighborhoodLocalities(trimHeatmapLocalities(localityRows), pin),
  ]);

  const merged = buildMergedNeighborhoodCandidates(
    gridCandidates,
    localityFilter.kept,
    localityFilter.audit,
  );

  const neighborhoods = candidatesToPromoteList(merged, pin.city);

  setCached(cacheKey, neighborhoods);
  return neighborhoods;
}
