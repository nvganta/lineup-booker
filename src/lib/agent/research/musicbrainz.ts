import { getResearchFetch, RESEARCH_USER_AGENT } from "./fetch";
import { namesMatch } from "./match";
import type { ArtistBackground, ArtistResearchHints } from "./types";

const USER_AGENT = RESEARCH_USER_AGENT;

let lastMbAt = 0;
let mbChain: Promise<void> = Promise.resolve();

function scheduleMusicBrainz<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastMbAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastMbAt = Date.now();
    return fn();
  };
  const p = mbChain.then(run, run);
  mbChain = p.then(
    () => undefined,
    () => undefined,
  );
  return p;
}

type MbArtist = {
  id: string;
  name: string;
  type?: string;
  country?: string;
  "life-span"?: { begin?: string; end?: string };
  area?: { name?: string };
  "begin-area"?: { name?: string };
};

type MbSearchResponse = { artists?: MbArtist[] };

type MbReleaseGroup = { title?: string; "primary-type"?: string };

type MbReleaseGroupResponse = {
  "release-groups"?: MbReleaseGroup[];
};

function mbTypeOk(type?: string): boolean {
  if (!type) return true;
  return /person|group|orchestra|choir/i.test(type);
}

function pickMbArtist(
  artists: MbArtist[],
  artistName: string,
  hints?: ArtistResearchHints,
): MbArtist | null {
  const exact = artists.filter(
    (a) => namesMatch(a.name, artistName) && mbTypeOk(a.type),
  );
  const narrowed = hints?.country
    ? exact.filter(
        (a) => !a.country || a.country.toLowerCase() === hints.country!.toLowerCase(),
      )
    : exact;
  // Several artists share this name and nothing tells them apart: say nothing
  // rather than risk another act's bio on the card.
  return narrowed.length === 1 ? narrowed[0]! : null;
}

export async function researchFromMusicBrainz(
  artistName: string,
  hints?: ArtistResearchHints,
  signal?: AbortSignal,
): Promise<ArtistBackground | null> {
  return scheduleMusicBrainz(async () => {
    const fetch = getResearchFetch();
    const q = encodeURIComponent(`artist:"${artistName}"`);
    const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=${q}&fmt=json&limit=8`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal,
    });
    if (!searchRes.ok) return null;
    const searchJson = (await searchRes.json()) as MbSearchResponse;
    const hit = pickMbArtist(searchJson.artists ?? [], artistName, hints);
    if (!hit) return null;

    const origin = hit["begin-area"]?.name ?? hit.area?.name;
    const kind = /person/i.test(hit.type ?? "") ? "person" : hit.type ? "group" : undefined;
    // For a person MusicBrainz's life-span begin is a birth date, not a debut.
    const activeSince =
      kind === "group" ? hit["life-span"]?.begin?.slice(0, 4) : undefined;

    let notableReleases: string[] | undefined;
    const rgUrl = `https://musicbrainz.org/ws/2/release-group?artist=${hit.id}&type=album&fmt=json&limit=12`;
    const rgRes = await fetch(rgUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal,
    });
    if (rgRes.ok) {
      const rgJson = (await rgRes.json()) as MbReleaseGroupResponse;
      const titles = (rgJson["release-groups"] ?? [])
        .map((g) => g.title?.trim())
        .filter((t): t is string => Boolean(t));
      notableReleases = [...new Set(titles)].slice(0, 3);
    }

    const sourceUrl = `https://musicbrainz.org/artist/${hit.id}`;
    const knownFor =
      hints?.description && hints.description.length < 220
        ? hints.description
        : undefined;

    return {
      origin,
      activeSince,
      knownFor,
      notableReleases,
      kind,
      sourceUrl,
      sourceName: "MusicBrainz",
    };
  });
}

/** Begin-area only (no release-group fetch). */
export async function musicBrainzArtistBeginArea(
  artistName: string,
  hints?: ArtistResearchHints,
  signal?: AbortSignal,
): Promise<string | undefined> {
  return scheduleMusicBrainz(async () => {
    const fetch = getResearchFetch();
    const q = encodeURIComponent(`artist:"${artistName}"`);
    const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=${q}&fmt=json&limit=8`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal,
    });
    if (!searchRes.ok) return undefined;
    const searchJson = (await searchRes.json()) as MbSearchResponse;
    const hit = pickMbArtist(searchJson.artists ?? [], artistName, hints);
    if (!hit) return undefined;
    return hit["begin-area"]?.name ?? hit.area?.name;
  });
}

/** @internal tests */
export function resetMusicBrainzRateLimit(): void {
  lastMbAt = 0;
  mbChain = Promise.resolve();
}
