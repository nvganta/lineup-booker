const DEFAULT_TTL_MS = 90_000;

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const memory = new Map<string, CacheEntry>();

export function getCachedQlooResponse<T>(url: string): T | undefined {
  const hit = memory.get(url);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(url);
    return undefined;
  }
  return hit.data as T;
}

export function setCachedQlooResponse(
  url: string,
  data: unknown,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  memory.set(url, { data, expiresAt: Date.now() + ttlMs });
}

/** @internal tests */
export function clearQlooResponseCache(): void {
  memory.clear();
}
