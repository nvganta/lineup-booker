import { getResearchFetch, RESEARCH_USER_AGENT } from "./fetch";
import {
  isClearlyMusician,
  isConflictingNonMusicianProfile,
  namesMatch,
} from "./match";
import type { ArtistResearchHints } from "./types";

const SCREEN_MS = 1_500;

type WikiSummary = {
  title?: string;
  extract?: string;
  description?: string;
};

async function wikipediaSummary(
  title: string,
  signal?: AbortSignal,
): Promise<WikiSummary | null> {
  const fetch = getResearchFetch();
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  const res = await fetch(url, {
    signal,
    headers: {
      "User-Agent": RESEARCH_USER_AGENT,
      "Api-User-Agent": RESEARCH_USER_AGENT,
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as WikiSummary;
}

/**
 * Bench-only: drop name collisions (e.g. two different Fixture Ellis profiles)
 * and rows whose Wikipedia match is not clearly a musician.
 */
export async function isVerifiedMusicianForBench(
  artistName: string,
  hints?: ArtistResearchHints,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCREEN_MS);
  try {
    const signal = controller.signal;
    let sawMusician = false;
    let sawConflict = false;

    const titles: string[] = [];
    if (hints?.wikipediaTitle) titles.push(hints.wikipediaTitle);
    titles.push(`${artistName} (musician)`, artistName);

    for (const title of [...new Set(titles)]) {
      const summary = await wikipediaSummary(title, signal);
      if (!summary?.title) continue;
      const text = `${summary.description ?? ""} ${summary.extract ?? ""}`.trim();
      if (!namesMatch(summary.title, artistName)) continue;
      if (isClearlyMusician(text, summary.title, artistName)) {
        sawMusician = true;
      }
      if (isConflictingNonMusicianProfile(text, summary.title, artistName)) {
        sawConflict = true;
      }
    }

    if (sawMusician && sawConflict) return false;
    if (sawMusician) return true;

    if (hints?.wikipediaTitle) {
      const pinned = await wikipediaSummary(hints.wikipediaTitle, signal);
      if (pinned?.title && namesMatch(pinned.title, artistName)) {
        const text = `${pinned.description ?? ""} ${pinned.extract ?? ""}`.trim();
        return isClearlyMusician(text, pinned.title, artistName);
      }
    }

    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function filterVerifiedMusicianBench<T extends { name: string }>(
  entities: T[],
  hintsFor?: (entity: T) => ArtistResearchHints | undefined,
): Promise<T[]> {
  if (entities.length === 0) return entities;
  const flags = await Promise.all(
    entities.map((entity) =>
      isVerifiedMusicianForBench(entity.name, hintsFor?.(entity)),
    ),
  );
  return entities.filter((_, i) => flags[i]);
}
