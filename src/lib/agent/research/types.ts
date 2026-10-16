export type ArtistBackground = {
  origin?: string;
  activeSince?: string;
  /** ≤1 sentence from source summary */
  knownFor?: string;
  notableReleases?: string[];
  /** MusicBrainz artist type; a person's life-span begin is a birth year, not a debut. */
  kind?: "person" | "group";
  sourceUrl: string;
  sourceName: "Wikipedia" | "MusicBrainz";
};

export type ArtistResearchHints = {
  description?: string;
  wikipediaTitle?: string;
  wikidataId?: string;
  country?: string;
};

export type ArtistResearchInput = {
  id?: string;
  name: string;
  hints?: ArtistResearchHints;
};

export const RESEARCH_PER_ARTIST_MS = 4_000;
export const RESEARCH_TOTAL_MS = 5_000;
export const RESEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
