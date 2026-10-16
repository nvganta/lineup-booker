import { getResearchFetch, RESEARCH_USER_AGENT } from "./fetch";
import { namesMatch } from "./match";
import type { ArtistResearchHints } from "./types";

const SCREEN_MS = 1_500;

type WikiSummary = {
  title?: string;
  extract?: string;
  description?: string;
};

const MUSIC_ROLE =
  /\b(singer|songwriter|musician|band|rapper|dj|record producer|vocalist)\b/i;

/**
 * True when the Wikipedia lead names acting before any music role:
 * "an American actress, singer, and author" is actor-first;
 * "a singer and actress" is not.
 */
export function isActorFirstLead(text: string): boolean {
  const lead = text.split(/[.!?]/)[0] ?? text;
  const actor = lead.search(/\b(actress|actor)\b/i);
  if (actor < 0) return false;
  const music = lead.search(MUSIC_ROLE);
  return music < 0 || actor < music;
}

async function wikipediaSummaryForName(
  artistName: string,
  hints?: ArtistResearchHints,
  signal?: AbortSignal,
): Promise<WikiSummary | null> {
  const fetch = getResearchFetch();
  const titles: string[] = [];
  if (hints?.wikipediaTitle) titles.push(hints.wikipediaTitle);
  titles.push(artistName, `${artistName} (musician)`);

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
    const summary = (await res.json()) as WikiSummary;
    if (summary.title && namesMatch(summary.title, artistName)) {
      return summary;
    }
  }
  return null;
}

export async function filterActorFirstEntities<T extends { name: string }>(
  entities: T[],
  hintsFor?: (entity: T) => ArtistResearchHints | undefined,
): Promise<T[]> {
  if (entities.length === 0) return entities;
  const blocked = await filterActorFirstNames(
    entities.map((e) => ({
      name: e.name,
      hints: hintsFor?.(e),
    })),
  );
  return entities.filter((e) => !blocked.has(e.name.toLowerCase()));
}

export async function isActorFirstByWikipedia(
  artistName: string,
  hints?: ArtistResearchHints,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCREEN_MS);
  try {
    const summary = await wikipediaSummaryForName(
      artistName,
      hints,
      controller.signal,
    );
    if (!summary) return false;
    const text = `${summary.description ?? ""} ${summary.extract ?? ""}`.trim();
    if (!text) return false;
    if (summary.title && !namesMatch(summary.title, artistName)) return false;
    return isActorFirstLead(text);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function filterActorFirstNames(
  names: Array<{ name: string; hints?: ArtistResearchHints }>,
): Promise<Set<string>> {
  const actorFirst = new Set<string>();
  await Promise.all(
    names.map(async ({ name, hints }) => {
      if (await isActorFirstByWikipedia(name, hints)) {
        actorFirst.add(name.toLowerCase());
      }
    }),
  );
  return actorFirst;
}
