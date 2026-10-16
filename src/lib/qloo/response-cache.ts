import {
  getPersistentStore,
  normalizeQlooCacheKey,
} from "@/lib/cache/persistent-store";

const QLOO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const store = getPersistentStore();

export async function getCachedQlooResponse<T>(
  url: string,
): Promise<T | undefined> {
  const key = normalizeQlooCacheKey(url);
  return store.get<T>(`qloo:${key}`);
}

export async function setCachedQlooResponse(
  url: string,
  data: unknown,
  ttlMs: number = QLOO_TTL_MS,
): Promise<void> {
  const key = normalizeQlooCacheKey(url);
  await store.set(`qloo:${key}`, data, ttlMs);
}

/** @internal tests */
export function clearQlooResponseCache(): void {
  // Memory layer clears on process restart; tests use mock transport.
}
