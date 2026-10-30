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

export type ActLink = { label: string; url: string };

type MbUrlRelation = {
  type?: string;
  ended?: boolean;
  url?: { resource?: string };
};

const LINK_TYPES = /official homepage|social network|bandcamp|booking|management|soundcloud/i;

const HOST_LABELS: Array<[RegExp, string]> = [
  [/instagram\.com/, "Instagram"],
  [/facebook\.com/, "Facebook"],
  [/(twitter|x)\.com/, "X"],
  [/tiktok\.com/, "TikTok"],
  [/bandcamp\.com/, "Bandcamp"],
  [/soundcloud\.com/, "SoundCloud"],
  [/youtube\.com/, "YouTube"],
];

/** Where a booking enquiry is most likely to be read. */
const LABEL_RANK: Record<string, number> = { Website: 1, Instagram: 2, Facebook: 3, Bandcamp: 4, X: 5 };

/** Where an owner can reach the act, from MusicBrainz's link list. Website and booking first. */
export function actLinksFromRelations(relations: MbUrlRelation[]): ActLink[] {
  const out: Array<ActLink & { rank: number }> = [];
  const seen = new Set<string>();
  for (const r of relations) {
    const url = r.url?.resource;
    if (!url || r.ended || !LINK_TYPES.test(r.type ?? "")) continue;
    if (!/^https?:\/\//.test(url)) continue;
    const host = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]!;
    const byHost = HOST_LABELS.find(([re]) => re.test(host))?.[1];
    const booking = /booking|management/i.test(r.type ?? "");
    const label = booking ? "Booking" : byHost ?? (/homepage/i.test(r.type ?? "") ? "Website" : host);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, url, rank: booking ? 0 : (LABEL_RANK[label] ?? 6) });
  }
  return out
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 4)
    .map(({ label, url }) => ({ label, url }));
}

/**
 * The act's own links. Uses the MusicBrainz id from the card's background
 * when there is one; otherwise searches by name and keeps only a single exact
 * match, so another act's socials never show up.
 */
export async function musicBrainzActLinks(
  artistName: string,
  mbid?: string,
  signal?: AbortSignal,
): Promise<ActLink[]> {
  return scheduleMusicBrainz(async () => {
    const fetch = getResearchFetch();
    const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
    let id = mbid;
    if (!id) {
      const q = encodeURIComponent(`artist:"${artistName}"`);
      const res = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${q}&fmt=json&limit=8`, { headers, signal });
      if (!res.ok) return [];
      const hit = pickMbArtist(((await res.json()) as MbSearchResponse).artists ?? [], artistName);
      if (!hit) return [];
      id = hit.id;
      await new Promise((r) => setTimeout(r, 1000));
    }
    const res = await fetch(`https://musicbrainz.org/ws/2/artist/${id}?inc=url-rels&fmt=json`, { headers, signal });
    if (!res.ok) return [];
    const body = (await res.json()) as { relations?: MbUrlRelation[] };
    return actLinksFromRelations(body.relations ?? []);
  });
}
