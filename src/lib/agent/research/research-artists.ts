import {
  getCachedArtistBackground,
  setCachedArtistBackground,
} from "./cache";
import { getResearchFetch } from "./fetch";
import { mergeBackgrounds, researchFromWikipedia } from "./wikipedia";
import { researchFromMusicBrainz } from "./musicbrainz";
import type {
  ArtistBackground,
  ArtistResearchInput,
} from "./types";
import { RESEARCH_PER_ARTIST_MS } from "./types";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

export async function researchOneArtist(
  input: ArtistResearchInput,
): Promise<ArtistBackground | null> {
  const cached = await getCachedArtistBackground(input.name, input.id);
  if (cached) return cached;

  const controller = new AbortController();
  const perArtist = withTimeout(
    (async () => {
      void getResearchFetch;
      const [wiki, mb] = await Promise.all([
        researchFromWikipedia(input.name, input.hints, controller.signal),
        researchFromMusicBrainz(input.name, input.hints, controller.signal),
      ]);
      return mergeBackgrounds(wiki, mb);
    })(),
    RESEARCH_PER_ARTIST_MS,
  );

  const merged = await perArtist;
  controller.abort();
  if (merged) {
    await setCachedArtistBackground(input.name, input.id, merged);
  }
  return merged;
}

export async function researchArtists(
  artists: ArtistResearchInput[],
): Promise<Record<string, ArtistBackground>> {
  const unique = new Map<string, ArtistResearchInput>();
  for (const a of artists) {
    const key = (a.id ?? a.name).toLowerCase();
    if (!unique.has(key)) unique.set(key, a);
  }
  const entries = await Promise.all(
    [...unique.values()].map(async (a) => {
      const bg = await researchOneArtist(a);
      const key = a.id ?? a.name;
      return [key, bg] as const;
    }),
  );
  const out: Record<string, ArtistBackground> = {};
  for (const [key, bg] of entries) {
    if (bg) out[key] = bg;
  }
  return out;
}

function withArticle(place: string): string {
  return /^(united|netherlands|philippines|czech republic|bahamas)\b/i.test(place)
    ? `the ${place}`
    : place;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

/**
 * One plain background line. A Wikipedia lead sentence already reads well, so
 * it is shown as-is; otherwise build from MusicBrainz facts without implying a
 * birth year is a debut or that an arbitrary release is what they're known for.
 */
export function formatBackgroundLine(bg: ArtistBackground): string {
  if (bg.knownFor) return clip(bg.knownFor.trim(), 160);
  const parts: string[] = [];
  if (bg.origin) parts.push(`From ${withArticle(bg.origin.replace(/\s+/g, " ").trim())}`);
  if (bg.activeSince && bg.kind === "group") {
    parts.push(parts.length ? `together since ${bg.activeSince}` : `Together since ${bg.activeSince}`);
  }
  const album = bg.notableReleases?.[0];
  if (album) parts.push(parts.length ? `albums include ${album}` : `Albums include ${album}`);
  if (!parts.length) return "";
  const line = parts.join(", ");
  return /[.!?…]$/.test(line) ? line : `${line}.`;
}
