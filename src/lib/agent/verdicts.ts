import type { QlooEntity } from "@/lib/qloo/types";
import type { PopularityBand } from "@/lib/lineup/tiers";
import {
  isLikelyArenaActForSmallRoom,
  isMusicArtist,
  qlooObscurityLevel,
} from "@/lib/lineup/artist-filter";
import type { ToolVerdict, VerdictLevel } from "./types";
import type { VenuePin } from "@/lib/lineup/geography";

export function verdictVenue(
  pin: VenuePin | undefined,
): ToolVerdict {
  if (!pin) {
    return { level: "fail", reasons: ["no_geocode"] };
  }
  if (pin.lat && pin.lon && pin.city) {
    return {
      level: "good",
      reasons: [],
      evidence: { lat: pin.lat, lon: pin.lon, city: pin.city },
    };
  }
  if (pin.city) {
    return { level: "weak", reasons: ["city_only"], evidence: { city: pin.city } };
  }
  return { level: "fail", reasons: ["no_pin"] };
}

export function verdictTags(
  phraseCount: number,
  tagCount: number,
): ToolVerdict {
  if (tagCount === 0) {
    return { level: "fail", reasons: ["no_music_tags"] };
  }
  if (tagCount >= phraseCount && phraseCount > 0) {
    return { level: "good", reasons: [], evidence: { tags: tagCount } };
  }
  return {
    level: tagCount >= 1 ? "weak" : "fail",
    reasons: tagCount >= 1 ? ["partial_tag_coverage"] : ["no_music_tags"],
    evidence: { tags: tagCount, phrases: phraseCount },
  };
}

export function verdictHeadliner(
  picked: QlooEntity | null,
  candidates: QlooEntity[],
  band: PopularityBand,
  tagIds: string[],
): ToolVerdict {
  if (!picked) {
    return { level: "fail", reasons: ["no_headliner"] };
  }
  const pop = picked.popularity ?? 0;
  const inBand =
    (band.headlinerMin == null || pop >= band.headlinerMin) &&
    (band.headlinerMax == null || pop <= band.headlinerMax);
  const obscurity =
    band.seatCapacity != null && band.seatCapacity <= 300
      ? (qlooObscurityLevel(picked) ?? 99) >= 3
      : true;
  const musicOk = isMusicArtist(picked, tagIds);
  const arenaOk = !isLikelyArenaActForSmallRoom(picked, band, tagIds);

  if (inBand && obscurity && musicOk && arenaOk) {
    return {
      level: "good",
      reasons: [],
      evidence: { popularity: pop, candidates: candidates.length },
    };
  }
  const reasons: string[] = [];
  if (!inBand) reasons.push("out_of_band");
  if (!obscurity) reasons.push("obscurity");
  if (!musicOk) reasons.push("not_music_artist");
  if (!arenaOk) reasons.push("arena_act");
  const nearBand =
    !inBand &&
    band.headlinerMax != null &&
    pop <= band.headlinerMax + 0.05 &&
    (band.headlinerMin == null || pop >= band.headlinerMin - 0.05);

  if (nearBand || candidates.length === 1) {
    return {
      level: "weak",
      reasons,
      evidence: { popularity: pop, candidates: candidates.length },
    };
  }
  return {
    level: "fail",
    reasons,
    evidence: { popularity: pop, candidates: candidates.length },
  };
}

export function verdictOpener(
  opener: QlooEntity | null,
  hasLocal: boolean,
): ToolVerdict {
  if (!opener) {
    return { level: "fail", reasons: ["no_opener"] };
  }
  if (hasLocal) {
    return { level: "good", reasons: [], evidence: { local: true } };
  }
  return { level: "weak", reasons: ["no_local_signal"], evidence: { local: false } };
}

export function verdictNeighborhoods(
  count: number,
  hasAdminLabel: boolean,
): ToolVerdict {
  if (hasAdminLabel) {
    return { level: "weak", reasons: ["admin_label_present"] };
  }
  if (count >= 4) {
    return { level: "good", reasons: [], evidence: { count } };
  }
  if (count >= 2) {
    return { level: "weak", reasons: ["few_neighborhoods"], evidence: { count } };
  }
  return { level: "fail", reasons: ["too_few_neighborhoods"], evidence: { count } };
}

export function mergeVerdict(levels: VerdictLevel[]): VerdictLevel {
  if (levels.includes("fail")) return "fail";
  if (levels.includes("weak")) return "weak";
  return "good";
}
