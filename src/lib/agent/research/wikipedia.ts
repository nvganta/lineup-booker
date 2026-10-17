import { getResearchFetch, RESEARCH_USER_AGENT } from "./fetch";
import { firstSentence, isClearlyMusician } from "./match";
import type { ArtistBackground, ArtistResearchHints } from "./types";

type WikiSummary = {
  title?: string;
  extract?: string;
  description?: string;
  content_urls?: { desktop?: { page?: string } };
};

type WikiSearchResponse = {
  query?: { search?: Array<{ title?: string }> };
};

function titleFromWikipediaUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("wikipedia.org")) return undefined;
    const parts = u.pathname.split("/wiki/");
    const raw = parts[1];
    return raw ? decodeURIComponent(raw.replace(/_/g, " ")) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchWikiSummary(
  title: string,
  signal?: AbortSignal,
): Promise<WikiSummary | null> {
  const fetch = getResearchFetch();
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": RESEARCH_USER_AGENT, "Api-User-Agent": RESEARCH_USER_AGENT },
  });
  if (!res.ok) return null;
  return (await res.json()) as WikiSummary;
}

async function searchWikiTitles(
  artistName: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const fetch = getResearchFetch();
  const queries = [
    `${artistName} musician`,
    `${artistName} band`,
    artistName,
  ];
  const titles: string[] = [];
  for (const q of queries) {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(q)}&srlimit=5&format=json&origin=*`;
    const res = await fetch(url, {
      signal,
      headers: { "User-Agent": RESEARCH_USER_AGENT, "Api-User-Agent": RESEARCH_USER_AGENT },
    });
    if (!res.ok) continue;
    const json = (await res.json()) as WikiSearchResponse;
    for (const hit of json.query?.search ?? []) {
      if (hit.title) titles.push(hit.title);
    }
  }
  return [...new Set(titles)];
}

export function originFromExtract(extract: string): string | undefined {
  const born = extract.match(/\bborn in ([^,.]+(?:,\s*[^,.]+)?)/i);
  if (born?.[1]) return born[1].trim();
  const from = extract.match(/\bfrom ([^,.]+(?:,\s*[^,.]+)?)/i);
  if (from?.[1]) return from[1].trim();
  return undefined;
}

function activeSinceFromExtract(extract: string): string | undefined {
  const m = extract.match(/\b(?:since|formed in|active since)\s+(\d{4})\b/i);
  // A birth year is not a debut year, so "born 1982" is deliberately ignored.
  return m?.[1];
}

export async function researchFromWikipedia(
  artistName: string,
  hints?: ArtistResearchHints,
  signal?: AbortSignal,
): Promise<ArtistBackground | null> {
  const candidates: string[] = [];
  if (hints?.wikipediaTitle) candidates.push(hints.wikipediaTitle);
  if (hints && "wikipediaUrl" in hints) {
    const url = (hints as { wikipediaUrl?: string }).wikipediaUrl;
    if (url) {
      const t = titleFromWikipediaUrl(url);
      if (t) candidates.push(t);
    }
  }

  const searched = await searchWikiTitles(artistName, signal);
  candidates.push(...searched);

  const seen = new Set<string>();
  for (const title of candidates) {
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const summary = await fetchWikiSummary(title, signal);
    if (!summary?.extract) continue;
    const desc = summary.description ?? summary.extract;
    if (!isClearlyMusician(desc, summary.title ?? title, artistName)) continue;

    const pageUrl =
      summary.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

    return {
      origin: originFromExtract(summary.extract),
      activeSince: activeSinceFromExtract(summary.extract),
      knownFor: firstSentence(summary.extract),
      sourceUrl: pageUrl,
      sourceName: "Wikipedia",
    };
  }
  return null;
}

export function wikipediaTitleFromHints(hints?: ArtistResearchHints): string | undefined {
  if (hints?.wikipediaTitle) return hints.wikipediaTitle;
  return undefined;
}

/** Merge wiki + mb preferring wiki for knownFor and mb for releases */
export function mergeBackgrounds(
  wiki: ArtistBackground | null,
  mb: ArtistBackground | null,
): ArtistBackground | null {
  if (!wiki && !mb) return null;
  if (wiki && !mb) return wiki;
  if (mb && !wiki) return mb;
  const w = wiki!;
  const m = mb!;
  const sourceName = w.knownFor ? w.sourceName : m.sourceName;
  const sourceUrl = w.knownFor ? w.sourceUrl : m.sourceUrl;
  return {
    origin: w.origin ?? m.origin,
    activeSince: w.activeSince ?? m.activeSince,
    knownFor: w.knownFor ?? m.knownFor,
    notableReleases: m.notableReleases?.length ? m.notableReleases : w.notableReleases,
    sourceUrl,
    sourceName,
  };
}
