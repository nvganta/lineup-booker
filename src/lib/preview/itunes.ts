import { getPersistentStore } from "@/lib/cache/persistent-store";

/** A 30-second preview from Apple's public search, playable in an <audio>. */
export type TrackPreview = {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl?: string;
};

type ItunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  kind?: string;
};

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PREVIEW_LIMIT = 3;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Keep songs whose credited artist is the act, not a namesake or a feature. */
export function pickPreviews(
  artist: string,
  results: ItunesResult[],
  limit = PREVIEW_LIMIT,
): TrackPreview[] {
  const want = norm(artist);
  const seen = new Set<string>();
  const out: TrackPreview[] = [];
  for (const r of results) {
    if (r.kind && r.kind !== "song") continue;
    if (!r.previewUrl || !r.trackName || !r.artistName || r.trackId == null) continue;
    if (norm(r.artistName) !== want) continue;
    // "Song (Radio Mix)" and "Song (Instrumental)" are one song for a quick listen.
    const key = norm(r.trackName.replace(/\s*[([].*$/, ""))
      .replace(/\b(live|remix|acoustic|version|edit|instrumental)\b.*$/, "")
      .trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(r.trackId),
      title: r.trackName,
      artist: r.artistName,
      previewUrl: r.previewUrl,
      artworkUrl: r.artworkUrl100,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function fetchArtistPreviews(artist: string): Promise<TrackPreview[]> {
  const key = `preview:itunes:v1:${norm(artist)}`;
  const store = getPersistentStore();
  const hit = await store.get<TrackPreview[]>(key);
  if (hit) return hit;
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", artist);
  url.searchParams.set("entity", "song");
  url.searchParams.set("attribute", "artistTerm");
  url.searchParams.set("limit", "12");
  const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
  if (!res.ok) throw new Error(`itunes ${res.status}`);
  const json = (await res.json()) as { results?: ItunesResult[] };
  const tracks = pickPreviews(artist, json.results ?? []);
  await store.set(key, tracks, TTL_MS);
  return tracks;
}
