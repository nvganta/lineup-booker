import {
  getResearchFetch,
  RESEARCH_USER_AGENT,
} from "@/lib/agent/research/fetch";
import type { ActLink } from "@/lib/agent/research/musicbrainz";

type WdSearch = {
  search?: Array<{ id: string; label?: string; description?: string }>;
};
type WdClaim = { mainsnak?: { datavalue?: { value?: unknown } } };
type WdEntity = { claims?: Record<string, WdClaim[]> };

const MUSIC =
  /\b(musician|singer|rapper|band|songwriter|producer|duo|group|dj|composer|vocalist|artist)\b/i;

// Wikidata property → how the link is shown and built from the stored value.
const PROPS: Array<[string, string, (v: string) => string]> = [
  ["P856", "Website", (v) => v],
  ["P2003", "Instagram", (v) => `https://www.instagram.com/${v}/`],
  ["P2013", "Facebook", (v) => `https://www.facebook.com/${v}`],
  ["P2002", "X", (v) => `https://x.com/${v}`],
];

/**
 * The act's official links from Wikidata, the second source when MusicBrainz
 * has none or can't be read. Only an item whose label is exactly the act's
 * name and whose description says it makes music counts.
 */
export async function wikidataActLinks(
  name: string,
  signal?: AbortSignal,
): Promise<ActLink[]> {
  const fetch = getResearchFetch();
  const headers = {
    "User-Agent": RESEARCH_USER_AGENT,
    Accept: "application/json",
  };
  const q = new URLSearchParams({
    action: "wbsearchentities",
    search: name,
    language: "en",
    type: "item",
    limit: "5",
    format: "json",
  });
  const res = await fetch(`https://www.wikidata.org/w/api.php?${q}`, {
    headers,
    signal,
  });
  if (!res.ok) return [];
  const hits = ((await res.json()) as WdSearch).search ?? [];
  const hit = hits.find(
    (h) =>
      h.label?.toLowerCase() === name.toLowerCase() &&
      MUSIC.test(h.description ?? ""),
  );
  if (!hit) return [];
  const data = await fetch(
    `https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`,
    { headers, signal },
  );
  if (!data.ok) return [];
  const entity = Object.values(
    ((await data.json()) as { entities?: Record<string, WdEntity> }).entities ??
      {},
  )[0];
  const out: ActLink[] = [];
  for (const [prop, label, toUrl] of PROPS) {
    const value = entity?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
    if (typeof value === "string" && value.trim())
      out.push({ label, url: toUrl(value.trim()) });
  }
  return out;
}
