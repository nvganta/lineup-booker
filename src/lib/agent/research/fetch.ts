/**
 * Wikimedia and MusicBrainz both require a descriptive User-Agent with contact
 * details; anonymous clients get throttled or blocked.
 */
export const RESEARCH_USER_AGENT =
  "LineupBooker/1.0 (+https://lineup-booker.vercel.app; venue lineup research)";

export type ResearchFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

let researchFetch: ResearchFetch = (...args) => fetch(...args);

export function getResearchFetch(): ResearchFetch {
  return researchFetch;
}

/** @internal tests */
export function setResearchFetch(next: ResearchFetch): void {
  researchFetch = next;
}

/** @internal tests */
export function resetResearchFetch(): void {
  researchFetch = (...args) => fetch(...args);
}
