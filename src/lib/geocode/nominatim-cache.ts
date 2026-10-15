import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type CacheEnvelope<T> = {
  value: T;
  savedAt: number;
};

function cachePath(): string {
  if (process.env.NOMINATIM_CACHE_PATH) {
    return process.env.NOMINATIM_CACHE_PATH;
  }
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "lineup-booker-nominatim.json");
  }
  return path.join(process.cwd(), ".cache", "nominatim.json");
}

let diskEntries: Record<string, CacheEnvelope<unknown>> | null = null;

function loadDisk(): Record<string, CacheEnvelope<unknown>> {
  if (diskEntries) return diskEntries;
  diskEntries = {};
  try {
    const raw = fs.readFileSync(/* turbopackIgnore: true */ cachePath(), "utf8");
    diskEntries = JSON.parse(raw) as Record<string, CacheEnvelope<unknown>>;
  } catch {
    diskEntries = {};
  }
  return diskEntries;
}

function persistDisk(): void {
  if (!diskEntries) return;
  try {
    const file = cachePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      /* turbopackIgnore: true */ file,
      JSON.stringify(diskEntries),
    );
  } catch {
    // Read-only or full disk — in-memory cache still works.
  }
}

export function readPersistentCache<T>(key: string): T | undefined {
  try {
    const hit = loadDisk()[key];
    return hit?.value as T | undefined;
  } catch {
    return undefined;
  }
}

export function writePersistentCache<T>(key: string, value: T): void {
  try {
    loadDisk()[key] = { value, savedAt: Date.now() };
    persistDisk();
  } catch {
    // Never fail the request because of cache writes.
  }
}
