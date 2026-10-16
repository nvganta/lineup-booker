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
import {
  collectRingNeighborhoodCandidates,
  type NeighborhoodResolveMeta,
} from "./neighborhood-fallback";
import type { PromoteNeighborhood } from "./neighborhoods";
import {
  prependHomeToPromoteList,
  promoteListWithHomeFirst,
  resolveHomeNeighborhoodLabel,
} from "./venue-home-area";

const MIN_PROMO_AREAS = 3;

export function buildMergedNeighborhoodCandidates(
  gridCandidates: NeighborhoodCandidate[],
  localityKept: LocalityRow[],
  localityAudit: LocalityAudit[],
): NeighborhoodCandidate[] {
  const distanceByName = new Map(
    localityAudit.map((row) => [row.name, row.distanceKm ?? undefined]),
  );

  const coordsByName = new Map(
    localityAudit.map((row) => [
      row.name,
      row.lat != null && row.lon != null
        ? { lat: row.lat, lon: row.lon }
        : undefined,
    ]),
  );

  const localityCandidates: NeighborhoodCandidate[] = localityKept.map(
    (entity) => {
      const coords = coordsByName.get(entity.name);
      return {
        name: entity.name,
        score: entity.query?.affinity ?? 0,
        source: "locality",
        distanceKm: distanceByName.get(entity.name),
        lat: coords?.lat,
        lon: coords?.lon,
      };
    },
  );

  return mergeNeighborhoodCandidates([
    ...gridCandidates,
    ...localityCandidates,
  ]);
}

const RESOLVE_BUDGET_MS = 7_000;
/** The ring may still start shortly after the budget; it caps itself at 5 s. */
const RING_GRACE_MS = 1_000;

export type ResolveNeighborhoodOptions = {
  tagIds?: string[];
  fetchTagHeatmap?: () => Promise<{
    grid: QlooHeatmapPoint[];
    localities: LocalityRow[];
  }>;
};

export async function resolvePromoteNeighborhoods(
  cacheKey: string,
  grid: QlooHeatmapPoint[],
  localityRows: LocalityRow[],
  pin: VenuePin,
  options?: ResolveNeighborhoodOptions,
): Promise<{ neighborhoods: PromoteNeighborhood[]; meta: NeighborhoodResolveMeta }> {
  let homeLabel = pin.homeNeighborhood ?? undefined;
  if (!homeLabel) {
    homeLabel = await resolveHomeNeighborhoodLabel(pin);
    if (homeLabel) pin.homeNeighborhood = homeLabel;
  }

  const cached = getCached<PromoteNeighborhood[]>(cacheKey);
  if (cached) {
    const list = homeLabel
      ? prependHomeToPromoteList(cached, pin, homeLabel)
      : cached;
    return { neighborhoods: list, meta: {} };
  }

  const meta: NeighborhoodResolveMeta = {};
  // Nominatim runs ~1 req/s; without a cap a thin heatmap plus both fallbacks
  // ran past the agent's limit and pushed Quick mode past Vercel's 60 s.
  const stopAt = Date.now() + RESOLVE_BUDGET_MS;

  const [{ candidates: gridCandidates }, localityFilter] = await Promise.all([
    collectGridNeighborhoodCandidates(grid, pin, stopAt),
    filterNeighborhoodLocalities(trimHeatmapLocalities(localityRows), pin, stopAt),
  ]);

  let merged = buildMergedNeighborhoodCandidates(
    gridCandidates,
    localityFilter.kept,
    localityFilter.audit,
  );

  let neighborhoods = candidatesToPromoteList(merged, pin.city);

  let tagGridForRing: QlooHeatmapPoint[] = grid;
  if (
    neighborhoods.length < MIN_PROMO_AREAS &&
    options?.fetchTagHeatmap &&
    options.tagIds?.length &&
    Date.now() < stopAt
  ) {
    const tagHeat = await options.fetchTagHeatmap();
    tagGridForRing = tagHeat.grid;
    const tagGrid = await collectGridNeighborhoodCandidates(
      tagHeat.grid,
      pin,
      stopAt,
    );
    const tagLocality = await filterNeighborhoodLocalities(
      trimHeatmapLocalities(tagHeat.localities),
      pin,
      stopAt,
    );
    const tagMerged = buildMergedNeighborhoodCandidates(
      tagGrid.candidates.map((c) => ({
        ...c,
        fallbackKind: "tag_heatmap" as const,
      })),
      tagLocality.kept,
      tagLocality.audit,
    );
    merged = mergeNeighborhoodCandidates([...merged, ...tagMerged]);
    neighborhoods = candidatesToPromoteList(merged, pin.city);
    if (tagMerged.length > 0) meta.usedTagHeatmap = true;
  }

  if (neighborhoods.length < MIN_PROMO_AREAS && Date.now() < stopAt + RING_GRACE_MS) {
    const ring = await collectRingNeighborhoodCandidates(pin, tagGridForRing);
    merged = mergeNeighborhoodCandidates([...merged, ...ring]);
    neighborhoods = candidatesToPromoteList(merged, pin.city);
    if (ring.length > 0) meta.usedRingFallback = true;
  }

  neighborhoods = promoteListWithHomeFirst(
    merged,
    pin,
    homeLabel,
    pin.city,
  );

  setCached(cacheKey, neighborhoods);
  return { neighborhoods, meta };
}
