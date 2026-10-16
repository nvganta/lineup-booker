import { buildLineup, type LineupResult } from "@/lib/lineup/build-lineup";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { openingSamplePlaceholder } from "@/lib/opening-sample-placeholder";
import fs from "node:fs/promises";
import path from "node:path";

export const OPENING_SAMPLE_REQUEST: LineupRequest = {
  concept: "Natural wine and small plates cafe-bar, 300 capacity",
  location: "2509 Main St, Vancouver, BC",
  regularsLove: "Indie folk and vinyl nights",
};

const CACHE_FILE = path.join("/tmp", "lineup-booker-opening-sample.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type DiskCache = {
  savedAt: string;
  lineup: LineupResult;
};

let memoryLineup: LineupResult | null = null;
let memoryLoadedAt = 0;

function stripProvenance(lineup: LineupResult): LineupResult {
  return { ...lineup, provenance: { requests: [] } };
}

function isFresh(savedAt: string): boolean {
  const t = Date.parse(savedAt);
  return Number.isFinite(t) && Date.now() - t < CACHE_TTL_MS;
}

async function readDiskCache(): Promise<LineupResult | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as DiskCache;
    if (!parsed?.lineup || !parsed.savedAt || !isFresh(parsed.savedAt)) {
      return null;
    }
    return parsed.lineup;
  } catch {
    return null;
  }
}

async function writeDiskCache(lineup: LineupResult): Promise<void> {
  const payload: DiskCache = {
    savedAt: new Date().toISOString(),
    lineup,
  };
  await fs.writeFile(CACHE_FILE, JSON.stringify(payload), "utf8");
}

async function buildOpeningSampleUncached(): Promise<LineupResult> {
  if (memoryLineup && Date.now() - memoryLoadedAt < CACHE_TTL_MS) {
    return memoryLineup;
  }

  const fromDisk = await readDiskCache();
  if (fromDisk) {
    memoryLineup = fromDisk;
    memoryLoadedAt = Date.now();
    return fromDisk;
  }

  try {
    const lineup = await buildLineup(OPENING_SAMPLE_REQUEST);
    memoryLineup = lineup;
    memoryLoadedAt = Date.now();
    await writeDiskCache(lineup);
    return lineup;
  } catch {
    // Do not cache placeholders — a transient Qloo failure must not stick for 24h.
    return openingSamplePlaceholder();
  }
}

/** Server-only: Vancouver opening preview (memory + /tmp cache on success only). */
export async function getOpeningSampleLineup(): Promise<LineupResult> {
  const lineup = await buildOpeningSampleUncached();
  return stripProvenance(lineup);
}
