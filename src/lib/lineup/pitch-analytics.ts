import { qlooGet } from "@/lib/qloo/client";
import type { QlooReceipt } from "@/lib/qloo/receipts";
import type {
  QlooEntity,
  QlooInsightsResponse,
  QlooTagsResponse,
} from "@/lib/qloo/types";
import {
  headlinerWhyFromQloo,
  openerWhyFromQloo,
  type ActWhyContext,
} from "./act-why-lines";
import { trimTagLabelForDisplay } from "@/lib/agent/step-copy";
import { formatCrowdDisplay } from "./crowd-display";
import { fetchHeadlinerDemographics } from "./demographics-qloo";
import type { ProvenanceRequest } from "./translate-venue";

export type ActAffinityRow = {
  id: string;
  name: string;
  localAffinity: number | null;
  nationalAffinity: number | null;
  whyLine: string | null;
};

export type OpenerOverlapResult = {
  value: number | null;
  label: string;
  method: "compare" | "insights" | "unavailable";
};

export type VenueTasteTag = {
  id: string;
  name: string;
  source: "concept" | "regulars";
};

export type CrowdDemographics = {
  age: Record<string, number> | null;
  gender: { male?: number; female?: number } | null;
};

export type PitchAnalytics = {
  acts: ActAffinityRow[];
  openerOverlap: OpenerOverlapResult;
  venueTags: VenueTasteTag[];
  demographics: CrowdDemographics | null;
  crowdLine: string | null;
  openerShowLocalBadge: boolean;
  /** The Qloo requests behind these numbers, for the receipts view. */
  qlooCalls?: QlooReceipt[];
};

function entityAffinity(
  entities: QlooEntity[] | undefined,
  id: string,
): number | null {
  const row = (entities ?? []).find(
    (e) => (e.entity_id ?? e.id) === id,
  );
  const aff = row?.query?.affinity;
  return typeof aff === "number" && Number.isFinite(aff) ? aff : null;
}

export type BatchActInsights = {
  affinity: Map<string, number | null>;
  popularity: Map<string, number | undefined>;
};

function entityPopularity(
  entities: QlooEntity[] | undefined,
  id: string,
): number | undefined {
  const row = (entities ?? []).find(
    (e) => (e.entity_id ?? e.id) === id,
  );
  const pop = row?.popularity;
  return typeof pop === "number" && Number.isFinite(pop) ? pop : undefined;
}

export async function fetchBatchActInsights(
  actIds: string[],
  locationQuery: string,
  requests: ProvenanceRequest[],
): Promise<BatchActInsights> {
  const affinity = new Map<string, number | null>();
  const popularity = new Map<string, number | undefined>();
  if (actIds.length === 0) return { affinity, popularity };
  try {
    const { data, request } = await qlooGet<QlooInsightsResponse>(
      "/v2/insights",
      {
        "filter.type": "urn:entity:artist",
        "filter.results.entities": actIds.join(","),
        "signal.location.query": locationQuery,
        take: Math.min(actIds.length, 12),
      },
    );
    requests.push(request);
    for (const id of actIds) {
      affinity.set(id, entityAffinity(data.results?.entities, id));
      popularity.set(id, entityPopularity(data.results?.entities, id));
    }
  } catch {
    for (const id of actIds) {
      affinity.set(id, null);
      popularity.set(id, undefined);
    }
  }
  return { affinity, popularity };
}

/** @deprecated use fetchBatchActInsights */
export async function fetchBatchActAffinities(
  actIds: string[],
  locationQuery: string,
  requests: ProvenanceRequest[],
): Promise<Map<string, number | null>> {
  const { affinity } = await fetchBatchActInsights(
    actIds,
    locationQuery,
    requests,
  );
  return affinity;
}

export function buildActAffinityRows(
  acts: Array<{ id: string; name: string }>,
  local: Map<string, number | null>,
  national: Map<string, number | null>,
  whyCtx: ActWhyContext,
  headlinerId: string,
  openerId: string | null,
  popularityByAct?: Map<string, number | undefined>,
): ActAffinityRow[] {
  return acts.map(({ id, name }) => {
    let whyLine: string | null = null;
    if (id === headlinerId) {
      whyLine = headlinerWhyFromQloo({
        ...whyCtx,
        headlinerPopularity:
          popularityByAct?.get(id) ?? whyCtx.headlinerPopularity,
      });
    } else if (openerId && id === openerId) {
      whyLine = openerWhyFromQloo({
        ...whyCtx,
        openerPopularity:
          popularityByAct?.get(id) ?? whyCtx.openerPopularity,
      });
    }
    return {
      id,
      name,
      localAffinity: local.get(id) ?? null,
      nationalAffinity: national.get(id) ?? null,
      whyLine,
    };
  });
}

type CompareTagRow = {
  name?: string;
  tag_id?: string;
  id?: string;
  query?: { affinity?: number; score?: number };
};

type CompareResponse = {
  results?: {
    affinity?: number;
    score?: number;
    tags?: CompareTagRow[];
    entities?: CompareTagRow[];
  };
};

const GENERIC_OVERLAP_TAG =
  /^(music|entertainment|pop music|rock music|united states|united kingdom|canada|england|australia|guitar|drums|drum|piano|vocals|voice|bass|violin|saxophone|trumpet|percussion|keyboard|hip hop|r&b|soul music)$/i;

export function isMeaningfulOverlapTag(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (GENERIC_OVERLAP_TAG.test(n)) return false;
  if (/^\d{4}s$/.test(n)) return false;
  if (/^(19|20)\d{2}$/.test(n)) return false;
  if (/^urn:/.test(n)) return false;
  return true;
}

export function overlapDisplayLabel(
  parsed: OpenerOverlapResult,
  headlinerName: string,
  openerName: string,
): string {
  if (parsed.method === "insights" && parsed.value != null) {
    return `How much ${headlinerName} fans also like ${openerName}`;
  }
  if (parsed.method === "compare" && parsed.value != null) {
    const tagMatch = parsed.label.match(/for “([^”]+)”/);
    if (tagMatch?.[1]) {
      return `Strongest shared taste: ${tagMatch[1]}, ${parsed.value.toFixed(2)}`;
    }
    return `Shared taste between ${headlinerName} and ${openerName}`;
  }
  return parsed.label;
}

/** Parse Qloo compare without inventing combined scores. */
export function parseCompareOverlap(data: CompareResponse): OpenerOverlapResult | null {
  const results = data.results;
  if (!results) return null;

  const tags = results.tags ?? [];
  if (tags.length > 0) {
    let best: CompareTagRow | null = null;
    let bestVal = -Infinity;
    for (const t of tags) {
      const tagName = t.name ?? t.tag_id ?? t.id ?? "";
      if (!isMeaningfulOverlapTag(String(tagName))) continue;
      const v = t.query?.affinity ?? t.query?.score;
      if (typeof v === "number" && v > bestVal) {
        bestVal = v;
        best = t;
      }
    }
    if (best && Number.isFinite(bestVal)) {
      const tagName = best.name ?? best.tag_id ?? best.id ?? "shared style";
      return {
        value: bestVal,
        label: `Shared-taste score for “${tagName}” (highest tag affinity from Qloo compare)`,
        method: "compare",
      };
    }
  }

  return null;
}

export async function fetchOpenerOverlap(
  headlinerId: string,
  openerId: string,
  requests: ProvenanceRequest[],
  names?: { headliner: string; opener: string },
): Promise<OpenerOverlapResult> {
  try {
    const { data, request } = await qlooGet<CompareResponse>(
      "/v2/analysis/compare",
      {
        "a.signal.interests.entities": headlinerId,
        "b.signal.interests.entities": openerId,
      },
    );
    requests.push(request);
    const parsed = parseCompareOverlap(data);
    if (parsed && names) {
      return { ...parsed, label: overlapDisplayLabel(parsed, names.headliner, names.opener) };
    }
    if (parsed) return parsed;
  } catch {
    /* fall through */
  }

  try {
    const { data, request } = await qlooGet<QlooInsightsResponse>(
      "/v2/insights",
      {
        "filter.type": "urn:entity:artist",
        "signal.interests.entities": headlinerId,
        "filter.results.entities": openerId,
        take: 1,
      },
    );
    requests.push(request);
    const aff = entityAffinity(data.results?.entities, openerId);
    if (aff != null) {
      const base: OpenerOverlapResult = {
        value: aff,
        label: "Headliner-seeded insights affinity for this opener",
        method: "insights",
      };
      if (names) {
        return {
          ...base,
          label: overlapDisplayLabel(base, names.headliner, names.opener),
        };
      }
      return base;
    }
  } catch {
    /* unavailable */
  }

  return {
    value: null,
    label: "not available",
    method: "unavailable",
  };
}

async function searchVenueTags(
  query: string,
  source: VenueTasteTag["source"],
  requests: ProvenanceRequest[],
): Promise<VenueTasteTag[]> {
  if (!query.trim()) return [];
  try {
    const { data, request } = await qlooGet<QlooTagsResponse>("/v2/tags", {
      "filter.query": query.trim(),
      "feature.semantic_search": true,
      take: 3,
    });
    requests.push(request);
    return (data.results?.tags ?? [])
      .map((t) => {
        const id = t.tag_id ?? t.id;
        if (!id) return null;
        return {
          id,
          name: trimTagLabelForDisplay(t.name ?? id),
          source,
        };
      })
      .filter((x): x is VenueTasteTag => x != null);
  } catch {
    return [];
  }
}

export async function fetchVenueTasteTags(
  concept: string,
  regularsLove: string,
  requests: ProvenanceRequest[],
): Promise<VenueTasteTag[]> {
  const conceptTags = await searchVenueTags(concept, "concept", requests);
  const regularsTags = await searchVenueTags(
    regularsLove,
    "regulars",
    requests,
  );
  const seen = new Set<string>();
  const merged: VenueTasteTag[] = [];
  for (const t of [...conceptTags, ...regularsTags]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    merged.push(t);
  }
  return dedupeVenueTasteTagList(merged).slice(0, 6);
}

function tagKeyWords(key: string): string[] {
  return key.split(" ").filter(Boolean);
}

const VENUE_TAG_FILLER_WORDS = new Set(["local", "the"]);

/** Loose key for near-duplicate venue tags (drops filler words like “local”). */
export function venueTagLooseDedupeKey(name: string): string {
  return normalizeVenueTagNameKey(name)
    .split(" ")
    .filter((w) => !VENUE_TAG_FILLER_WORDS.has(w))
    .join(" ");
}

function distinctiveVenueTagScore(
  tag: VenueTasteTag,
  peers: VenueTasteTag[],
): number {
  const words = tagKeyWords(normalizeVenueTagNameKey(tag.name));
  const peerWords = new Set(
    peers
      .filter((p) => p.id !== tag.id)
      .flatMap((p) => tagKeyWords(normalizeVenueTagNameKey(p.name))),
  );
  const unique = words.filter(
    (w) => !peerWords.has(w) && !VENUE_TAG_FILLER_WORDS.has(w),
  );
  return unique.length * 100 + words.length;
}

function pickBestVenueTagAmong(candidates: VenueTasteTag[]): VenueTasteTag {
  let best = candidates[0]!;
  let bestScore = distinctiveVenueTagScore(best, candidates);
  for (const c of candidates.slice(1)) {
    const score = distinctiveVenueTagScore(c, candidates);
    if (
      score > bestScore ||
      (score === bestScore && c.name.length > best.name.length)
    ) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

function venueTagsNearDuplicate(a: VenueTasteTag, b: VenueTasteTag): boolean {
  const aw = tagKeyWords(normalizeVenueTagNameKey(a.name));
  const bw = tagKeyWords(normalizeVenueTagNameKey(b.name));
  if (aw.length >= bw.length && bw.every((w) => aw.includes(w))) return true;
  if (bw.length >= aw.length && aw.every((w) => bw.includes(w))) return true;
  const shared = aw.filter((w) => bw.includes(w));
  return shared.length >= 2;
}

function clusterNearDuplicateVenueTags(tags: VenueTasteTag[]): VenueTasteTag[][] {
  const clusters: VenueTasteTag[][] = [];
  for (const tag of tags) {
    let placed = false;
    for (const cluster of clusters) {
      if (cluster.some((t) => venueTagsNearDuplicate(t, tag))) {
        cluster.push(tag);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([tag]);
  }
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (
          clusters[i]!.some((a) =>
            clusters[j]!.some((b) => venueTagsNearDuplicate(a, b)),
          )
        ) {
          clusters[i]!.push(...clusters[j]!);
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }
  return clusters;
}

export function dedupeVenueTasteTagList(tags: VenueTasteTag[]): VenueTasteTag[] {
  const subsetDeduped = dedupeVenueTagsByWordSubset(tags);
  return clusterNearDuplicateVenueTags(subsetDeduped).map((group) =>
    group.length === 1 ? group[0]! : pickBestVenueTagAmong(group),
  );
}

/** Drop tags whose normalized words are a strict subset of a kept tag (keep the longer one). */
export function dedupeVenueTagsByWordSubset(tags: VenueTasteTag[]): VenueTasteTag[] {
  const withKeys = tags.map((t) => ({
    tag: t,
    key: normalizeVenueTagNameKey(t.name),
  }));
  const kept: typeof withKeys = [];
  for (const entry of withKeys) {
    let drop = false;
    for (const other of withKeys) {
      if (entry === other) continue;
      const ew = tagKeyWords(entry.key);
      const ow = tagKeyWords(other.key);
      if (ew.length >= ow.length) continue;
      if (ew.every((w) => ow.includes(w))) {
        drop = true;
        break;
      }
    }
    if (!drop) kept.push(entry);
  }
  const out = [...kept];
  for (let i = out.length - 1; i >= 0; i--) {
    const ew = tagKeyWords(out[i]!.key);
    for (let j = 0; j < out.length; j++) {
      if (i === j) continue;
      const ow = tagKeyWords(out[j]!.key);
      if (ow.length > ew.length && ow.every((w) => ew.includes(w))) {
        out.splice(i, 1);
        break;
      }
    }
  }
  return out.map((x) => x.tag);
}

export function normalizeVenueTagNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\bneighbourhoods?\b/g, "neighborhood")
    .replace(/\bneighborhoods?\b/g, "neighborhood")
    .replace(/\bbars\b/g, "bar")
    .replace(/\bbar\b/g, "bar")
    .replace(/\s+/g, " ")
    .trim();
}

export type PitchAnalyticsInput = {
  cityQuery: string;
  countryQuery: string;
  cityLabel: string;
  headliner: { id: string; name: string };
  opener: { id: string; name: string } | null;
  bench: Array<{ id: string; name: string }>;
  concept: string;
  regularsLove: string;
  musicTagIds: string[];
  openerOriginMatchesCity?: boolean;
  headlinerPoolSize?: number;
  headlinerRankInPool?: number;
  headlinerPopularity?: number;
  openerPopularity?: number;
  tagLabels?: string[];
  /** The scout already fetched these; passing them back saves a Qloo call. */
  crowdDemographics?: CrowdDemographics | null;
};

export async function buildPitchAnalytics(
  input: PitchAnalyticsInput,
): Promise<{ analytics: PitchAnalytics; requests: ProvenanceRequest[] }> {
  const requests: ProvenanceRequest[] = [];
  const actIds = [
    input.headliner.id,
    ...(input.opener ? [input.opener.id] : []),
    ...input.bench.map((b) => b.id),
  ].filter((id, i, a) => a.indexOf(id) === i);

  const actsMeta = [
    input.headliner,
    ...(input.opener ? [input.opener] : []),
    ...input.bench,
  ].filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);

  const whyCtx: ActWhyContext = {
    cityLabel: input.cityLabel,
    tagLabels: (input.tagLabels ?? []).map(trimTagLabelForDisplay),
    headlinerPoolSize: input.headlinerPoolSize,
    headlinerRankInPool: input.headlinerRankInPool,
    headlinerPopularity: input.headlinerPopularity,
    openerPopularity: input.openerPopularity,
  };

  const [localBatch, nationalBatch, overlap, venueTags, demoResult] =
    await Promise.all([
      fetchBatchActInsights(actIds, input.cityQuery, requests),
      fetchBatchActInsights(actIds, input.countryQuery, requests),
      input.opener
        ? fetchOpenerOverlap(
            input.headliner.id,
            input.opener.id,
            requests,
            {
              headliner: input.headliner.name,
              opener: input.opener.name,
            },
          )
        : Promise.resolve({
            value: null,
            label: "not available",
            method: "unavailable" as const,
          }),
      fetchVenueTasteTags(input.concept, input.regularsLove, requests),
      input.crowdDemographics
        ? Promise.resolve({ demographics: input.crowdDemographics })
        : fetchHeadlinerDemographics(
            input.headliner.id,
            input.cityQuery,
            requests,
          ),
    ]);

  const localMap = localBatch.affinity;
  const nationalMap = nationalBatch.affinity;
  const popularityByAct = nationalBatch.popularity;

  const acts = buildActAffinityRows(
    actsMeta,
    localMap,
    nationalMap,
    whyCtx,
    input.headliner.id,
    input.opener?.id ?? null,
    popularityByAct,
  );

  const openerShowLocalBadge = Boolean(
    input.opener && input.openerOriginMatchesCity === true,
  );

  return {
    analytics: {
      acts,
      openerOverlap: overlap,
      venueTags,
      demographics: demoResult.demographics,
      crowdLine: formatCrowdDisplay(demoResult.demographics),
      openerShowLocalBadge,
    },
    requests,
  };
}
