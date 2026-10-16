import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type PersistentStore = {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
};

type Entry = { value: unknown; expiresAt: number };

const memory = new Map<string, Entry>();

function defaultDiskPath(): string {
  if (process.env.PERSISTENT_CACHE_PATH) {
    return process.env.PERSISTENT_CACHE_PATH;
  }
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "lineup-booker-persistent-cache.json");
  }
  return path.join(process.cwd(), ".cache", "persistent-store.json");
}

let diskLoaded = false;
let diskEntries: Record<string, Entry> = {};

async function loadDisk(): Promise<void> {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    const raw = await fs.readFile(
      /* turbopackIgnore: true */ defaultDiskPath(),
      "utf8",
    );
    diskEntries = JSON.parse(raw) as Record<string, Entry>;
  } catch {
    diskEntries = {};
  }
}

async function persistDisk(): Promise<void> {
  try {
    const file = defaultDiskPath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(diskEntries));
  } catch {
    // ignore
  }
}

function readEntry(key: string): Entry | undefined {
  const hit = memory.get(key) ?? diskEntries[key];
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key);
    delete diskEntries[key];
    return undefined;
  }
  return hit;
}

export function createMemoryTmpStore(): PersistentStore {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      await loadDisk();
      const hit = readEntry(key);
      return hit?.value as T | undefined;
    },
    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
      await loadDisk();
      const entry: Entry = { value, expiresAt: Date.now() + ttlMs };
      memory.set(key, entry);
      diskEntries[key] = entry;
      await persistDisk();
    },
  };
}

async function kvFetch(
  command: string[],
): Promise<{ result?: unknown } | null> {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const path = command
    .map((part, i) =>
      i === 1 || i === 2 ? encodeURIComponent(String(part)) : part,
    )
    .join("/");
  const res = await fetch(`${url}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { result?: unknown };
}

export function createRedisBackedStore(
  inner: PersistentStore = createMemoryTmpStore(),
): PersistentStore {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const prefixed = `lb:${key}`;
      const raw = await kvFetch(["get", prefixed]);
      if (raw?.result != null && typeof raw.result === "string") {
        try {
          const parsed = JSON.parse(raw.result) as Entry;
          if (parsed.expiresAt > Date.now()) return parsed.value as T;
        } catch {
          /* fall through */
        }
      }
      return inner.get<T>(key);
    },
    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
      const entry: Entry = { value, expiresAt: Date.now() + ttlMs };
      const prefixed = `lb:${key}`;
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      await kvFetch([
        "set",
        prefixed,
        JSON.stringify(entry),
        "EX",
        String(ttlSec),
      ]);
      await inner.set(key, value, ttlMs);
    },
  };
}

let singleton: PersistentStore | null = null;

export function getPersistentStore(): PersistentStore {
  if (!singleton) {
    singleton = createRedisBackedStore(createMemoryTmpStore());
  }
  return singleton;
}

export function normalizeQlooCacheKey(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("X-Api-Key");
    u.searchParams.delete("x-api-key");
    return `${u.origin}${u.pathname}?${u.searchParams.toString()}`;
  } catch {
    return url.replace(/X-Api-Key=[^&]+&?/gi, "");
  }
}
