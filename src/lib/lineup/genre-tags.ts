import { qlooGet } from "@/lib/qloo/client";
import type { QlooTagsResponse } from "@/lib/qloo/types";
import type { ProvenanceRequest } from "./translate-venue";

const NOISE_WORDS =
  /\b(vinyl|records?|nights?|live music|live|djs?|crowd|regulars|listening)\b/gi;

const MAX_GENRE_TAGS = 4;

export function cleanRegularsPhrase(phrase: string): string {
  return phrase
    .replace(NOISE_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function regularsPhrases(regulars: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of regulars.split(/[,;&]|\band\b/gi)) {
    const cleaned = cleanRegularsPhrase(part.trim());
    if (cleaned.length < 2) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function topMusicTag(
  data: QlooTagsResponse,
): { id: string; name: string } | null {
  const tag = data.results?.tags?.[0];
  if (!tag) return null;
  const id = tag.tag_id ?? tag.id;
  if (!id) return null;
  return { id, name: tag.name ?? id };
}

async function searchMusicTagForPhrase(
  phrase: string,
  requests: ProvenanceRequest[],
): Promise<{ id: string; name: string } | null> {
  const { data, request } = await qlooGet<QlooTagsResponse>("/v2/tags", {
    "filter.query": phrase,
    "feature.semantic_search": true,
    "filter.tag.types": "urn:tag:genre:music",
    take: 1,
  });
  requests.push(request);
  return topMusicTag(data);
}

export async function resolveMusicGenreTags(
  regulars: string,
  concept: string,
  requests: ProvenanceRequest[],
): Promise<{ ids: string[]; labels: string[] }> {
  const ids: string[] = [];
  const labels: string[] = [];
  const seenIds = new Set<string>();
  const searchedQueries = new Set<string>();

  const phrases = regularsPhrases(regulars).slice(0, MAX_GENRE_TAGS);

  const phraseLookups = await Promise.all(
    phrases.map(async (phrase) => {
      const queryKey = phrase.toLowerCase();
      if (searchedQueries.has(queryKey)) return null;
      searchedQueries.add(queryKey);
      return searchMusicTagForPhrase(phrase, requests);
    }),
  );

  for (const top of phraseLookups) {
    if (!top || seenIds.has(top.id)) continue;
    seenIds.add(top.id);
    ids.push(top.id);
    labels.push(top.name);
  }

  if (ids.length < 2) {
    const fallbackQuery = phrases.join(" ") || regulars;
    const fallbackKey = fallbackQuery.toLowerCase();
    if (!searchedQueries.has(fallbackKey)) {
      searchedQueries.add(fallbackKey);
      const { data, request } = await qlooGet<QlooTagsResponse>("/v2/tags", {
        "filter.query": fallbackQuery,
        "feature.semantic_search": true,
        "filter.tag.types": "urn:tag:genre:music",
        take: MAX_GENRE_TAGS,
      });
      requests.push(request);
      for (const tag of data.results?.tags ?? []) {
        if (ids.length >= MAX_GENRE_TAGS) break;
        const id = tag.tag_id ?? tag.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        ids.push(id);
        labels.push(tag.name ?? id);
      }
    }
  }

  return { ids: ids.slice(0, MAX_GENRE_TAGS), labels };
}
