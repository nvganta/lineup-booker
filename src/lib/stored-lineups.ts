import type { PitchPayload } from "@/lib/agent/types";
import type { LineupRequest } from "@/lib/lineup/schemas";

const STORAGE_KEY = "lineup-booker:your-lineups";

export type StoredLineup = {
  id: string;
  venueLabel: string;
  cityLabel: string;
  headlinerImageUrl?: string;
  headlinerName: string;
  request: LineupRequest;
  pitch: PitchPayload;
  pinned?: boolean;
  savedAt: number;
};

function parseStored(raw: string | null): StoredLineup[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is StoredLineup =>
        item != null &&
        typeof item === "object" &&
        typeof (item as StoredLineup).id === "string" &&
        (item as StoredLineup).pitch != null,
    );
  } catch {
    return [];
  }
}

const EMPTY: StoredLineup[] = [];
let cachedRaw: string | null = null;
let cachedList: StoredLineup[] = EMPTY;

export function loadStoredLineups(): StoredLineup[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = raw ? parseStored(raw) : EMPTY;
  }
  return cachedList;
}

export function getServerStoredLineups(): StoredLineup[] {
  return EMPTY;
}

/** @internal tests */
export function resetStoredLineupsCacheForTests(): void {
  cachedRaw = null;
  cachedList = EMPTY;
}

export function saveStoredLineups(list: StoredLineup[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 24)));
  window.dispatchEvent(new Event("lineup-stored-lineups"));
}

export function subscribeStoredLineups(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener("lineup-stored-lineups", handler);
  return () => window.removeEventListener("lineup-stored-lineups", handler);
}

export function cityFromRequest(request: LineupRequest): string {
  const parts = request.location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2] ?? parts[0] ?? "";
  return parts[0] ?? "";
}

export function upsertStoredLineup(entry: StoredLineup): StoredLineup[] {
  const list = loadStoredLineups().filter((item) => item.id !== entry.id);
  const next = [entry, ...list];
  saveStoredLineups(next);
  return next;
}

export function toggleStoredPin(id: string): StoredLineup[] {
  const list = loadStoredLineups().map((item) =>
    item.id === id ? { ...item, pinned: !item.pinned } : item,
  );
  list.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return b.savedAt - a.savedAt;
  });
  saveStoredLineups(list);
  return list;
}

export function storedLineupId(request: LineupRequest, pitch: PitchPayload): string {
  return `${pitch.headliner.id}:${request.location}:${request.concept}`.toLowerCase();
}
