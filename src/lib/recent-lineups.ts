import type { LineupRequest } from "@/lib/lineup/schemas";

export type RecentLineup = {
  id: string;
  label: string;
  request: LineupRequest;
};

export function lineupRequestKey(request: LineupRequest): string {
  return [request.location, request.concept, request.regularsLove]
    .join("\n")
    .toLowerCase();
}

export function labelForLineupRequest(request: LineupRequest): string {
  const city =
    request.location
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(-2, -1)[0] ??
    request.location.split(",")[0]?.trim() ??
    "This room";
  const concept = request.concept.split(",")[0]?.trim() ?? request.concept;
  const short =
    concept.length > 36 ? `${concept.slice(0, 35).trim()}…` : concept;
  return `${short} · ${city}`;
}

export function pushRecentLineup(
  list: RecentLineup[],
  request: LineupRequest,
  label?: string,
): RecentLineup[] {
  const key = lineupRequestKey(request);
  const entry: RecentLineup = {
    id: key,
    label: label ?? labelForLineupRequest(request),
    request,
  };
  const without = list.filter((item) => item.id !== key);
  return [entry, ...without].slice(0, 6);
}
