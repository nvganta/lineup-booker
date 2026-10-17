import { getResearchFetch, RESEARCH_USER_AGENT } from "@/lib/agent/research/fetch";
import { musicBrainzArtistBeginArea } from "@/lib/agent/research/musicbrainz";
import type { ArtistResearchHints } from "@/lib/agent/research/types";
import { originFromExtract } from "@/lib/agent/research/wikipedia";

const ORIGIN_BUDGET_MS = 1_200;

async function wikipediaOriginFromScreenFetch(
  artistName: string,
  hints: ArtistResearchHints | undefined,
  signal: AbortSignal,
): Promise<string | undefined> {
  const fetch = getResearchFetch();
  const titles = [
    hints?.wikipediaTitle,
    artistName,
    `${artistName} (band)`,
    `${artistName} (musician)`,
  ].filter(Boolean) as string[];

  for (const title of [...new Set(titles)]) {
    const encoded = encodeURIComponent(title.replace(/ /g, "_"));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url, {
      signal,
      headers: {
        "User-Agent": RESEARCH_USER_AGENT,
        "Api-User-Agent": RESEARCH_USER_AGENT,
      },
    });
    if (!res.ok) continue;
    const summary = (await res.json()) as { extract?: string };
    if (!summary.extract) continue;
    const origin = originFromExtract(summary.extract);
    if (origin) return origin;
  }
  return undefined;
}

/** One wiki pass (bench screen titles); MusicBrainz begin-area only if wiki has no origin. */
export async function lookupArtistOrigin(
  artistName: string,
  hints: ArtistResearchHints | undefined,
  budgetMs = ORIGIN_BUDGET_MS,
): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const wikiOrigin = await wikipediaOriginFromScreenFetch(
      artistName,
      hints,
      controller.signal,
    );
    if (wikiOrigin) return wikiOrigin;
    return musicBrainzArtistBeginArea(artistName, hints, controller.signal);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
