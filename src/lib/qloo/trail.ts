// Client-safe: arranges a run's Qloo receipts as the path from room to lineup.
import type { PitchPayload } from "@/lib/agent/types";
import type { PitchAnalytics } from "@/lib/lineup/pitch-analytics";
import type { QlooReceipt } from "@/lib/qloo/receipts";

export type TrailStep =
  | "room"
  | "tags"
  | "pool"
  | "headliner"
  | "opener"
  | "neighborhoods"
  | "crowd"
  | "numbers";

/** One stop on the trail: a number, a plain line, and the requests behind it. */
export type TrailNode = {
  id: TrailStep;
  title: string;
  /** The big figure on the card: "3", "#2", "12 acts". */
  stat: string;
  line: string;
  receipts: QlooReceipt[];
};

/** Which stop a recorded request belongs to. */
export function receiptStep(r: QlooReceipt): TrailStep {
  const p = r.params;
  if (r.path === "/v2/tags" || r.path === "/search") return "tags";
  const type = p["filter.type"] ?? "";
  if (type === "urn:heatmap") return "neighborhoods";
  if (type === "urn:demographics") return "crowd";
  if (type === "urn:entity:artist" && !p["filter.results.entities"]) {
    return p["signal.interests.entities"] ? "opener" : "pool";
  }
  return "numbers";
}

function joinNames(names: string[], max = 3): string {
  const shown = names.slice(0, max);
  if (shown.length <= 1) return shown[0] ?? "";
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

export type TrailInput = {
  pitch: PitchPayload;
  analytics: PitchAnalytics | null;
  cityLabel?: string;
  capacity?: number;
  /** Already-humanised tag labels. */
  tagLabels: string[];
  crowdLine: string | null;
  neighborhoodNames: string[];
};

export function buildTrail({
  pitch,
  analytics,
  cityLabel,
  capacity,
  tagLabels,
  crowdLine,
  neighborhoodNames,
}: TrailInput): TrailNode[] {
  const by = new Map<TrailStep, QlooReceipt[]>();
  for (const r of [
    ...(pitch.qlooCalls ?? []),
    ...(analytics?.qlooCalls ?? []),
  ]) {
    const step = receiptStep(r);
    by.set(step, [...(by.get(step) ?? []), r]);
  }
  const city = cityLabel ?? "your city";
  const meta = pitch.meta ?? {};
  const pool = by.get("pool") ?? [];
  const band = pool[0]?.params;
  const bandText =
    band?.["filter.popularity.min"] || band?.["filter.popularity.max"]
      ? ` with popularity ${Number(band["filter.popularity.min"] ?? 0).toFixed(2)} to ${Number(band["filter.popularity.max"] ?? 1).toFixed(2)}`
      : "";
  const poolSize = meta.headlinerPoolSize ?? pool[0]?.results;
  const rank = meta.headlinerRankInPool;
  const openerReceipts = by.get("opener") ?? [];
  const hoods = by.get("neighborhoods") ?? [];
  const crowd = by.get("crowd") ?? [];
  const numbers = by.get("numbers") ?? [];

  const nodes: Array<TrailNode | null> = [
    {
      id: "room",
      title: "Your room",
      stat: capacity ? `${capacity} cap` : "Room",
      line: [
        meta.concept?.trim() || pitch.venueLabel,
        pitch.address,
        meta.regularsLove?.trim()
          ? `Regulars love ${meta.regularsLove.trim()}.`
          : "",
      ]
        .filter(Boolean)
        .join(". ")
        .replace(/\.\./g, "."),
      receipts: [],
    },
    tagLabels.length > 0 || by.has("tags")
      ? {
          id: "tags",
          title: "Taste tags",
          stat: String(tagLabels.length || (by.get("tags")?.length ?? 0)),
          line: tagLabels.length
            ? `Your words became Qloo tags: ${joinNames(tagLabels, 4)}.`
            : "Your words were matched to Qloo's taste tags.",
          receipts: by.get("tags") ?? [],
        }
      : null,
    poolSize != null || pool.length > 0
      ? {
          id: "pool",
          title: "Acts near you",
          stat: poolSize != null ? `${poolSize} acts` : "Acts",
          line: `${tagLabels[0] ? `${tagLabels[0]} acts` : "Acts"} Qloo places near ${city}${bandText}, so they fit the room.`,
          receipts: pool,
        }
      : null,
    {
      id: "headliner",
      title: "Headliner",
      stat: rank != null ? `#${rank}` : pitch.headliner.name,
      line:
        rank != null && poolSize != null
          ? `${pitch.headliner.name}, ranked #${rank} of ${poolSize} for your crowd. Picked in code from the pool, not by the model.`
          : `${pitch.headliner.name}, picked from the pool for your crowd.`,
      receipts: [],
    },
    pitch.opener
      ? {
          id: "opener",
          title: "Opener",
          stat: pitch.opener.name,
          line:
            pitch.openerWhy?.trim() ||
            `Acts ${pitch.headliner.name}'s fans also love, kept below the headliner in reach, local first.`,
          receipts: openerReceipts,
        }
      : null,
    neighborhoodNames.length > 0 || hoods.length > 0
      ? {
          id: "neighborhoods",
          title: "Where the fans live",
          stat: `${neighborhoodNames.length || hoods[0]?.results || 0} areas`,
          line: neighborhoodNames.length
            ? `From the fan heatmap for ${pitch.headliner.name}: ${joinNames(neighborhoodNames)}.`
            : `The fan heatmap for ${pitch.headliner.name} around the venue.`,
          receipts: hoods,
        }
      : null,
    crowdLine || crowd.length > 0
      ? {
          id: "crowd",
          title: "Who'll come",
          stat:
            crowdLine
              ?.split("·")[0]
              ?.replace(/^Skews\s*/i, "")
              .trim() || "Crowd",
          line: crowdLine
            ? `Qloo's audience skew for ${pitch.headliner.name} fans: ${crowdLine.toLowerCase()}.`
            : `Qloo's audience skew for ${pitch.headliner.name} fans.`,
          receipts: crowd,
        }
      : null,
    numbers.length > 0
      ? {
          id: "numbers",
          title: "The numbers",
          stat: `${numbers.length} calls`,
          line: "Reach in the city and the country, fan overlap between the two acts, and where fans eat and drink against the city.",
          receipts: numbers,
        }
      : null,
  ];
  return nodes.filter((n): n is TrailNode => n != null);
}
