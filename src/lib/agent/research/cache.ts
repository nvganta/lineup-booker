import { getPersistentStore } from "@/lib/cache/persistent-store";
import type { ArtistBackground } from "./types";
import { RESEARCH_CACHE_TTL_MS } from "./types";

const store = getPersistentStore();

function cacheKey(name: string, id?: string): string {
  const slug = name.trim().toLowerCase().replace(/\s+/g, "_");
  return `research:artist:${id ?? slug}:${slug}`;
}

export async function getCachedArtistBackground(
  name: string,
  id?: string,
): Promise<ArtistBackground | undefined> {
  return store.get<ArtistBackground>(cacheKey(name, id));
}

export async function setCachedArtistBackground(
  name: string,
  id: string | undefined,
  value: ArtistBackground,
  ttlMs: number = RESEARCH_CACHE_TTL_MS,
): Promise<void> {
  await store.set(cacheKey(name, id), value, ttlMs);
}
