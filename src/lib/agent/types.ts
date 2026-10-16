import type { LineupResult } from "@/lib/lineup/build-lineup";
import type { PopularityBand } from "@/lib/lineup/tiers";
import type { VenuePin } from "@/lib/lineup/geography";

export type VerdictLevel = "good" | "weak" | "fail";

export type ToolVerdict = {
  level: VerdictLevel;
  reasons: string[];
  evidence?: Record<string, string | number | boolean>;
};

export type StepKind =
  | "plan"
  | "venue"
  | "tags"
  | "headliner"
  | "opener"
  | "neighborhoods"
  | "crowd"
  | "research"
  | "pitch"
  | "retry"
  | "quick";

import type { ArtistBackground } from "./research/types";

export type { ArtistBackground } from "./research/types";

export type ArtistBackgroundCard = {
  line: string;
  sourceName: ArtistBackground["sourceName"];
  sourceUrl: string;
};

export type StepDataPart = {
  id: string;
  kind: StepKind;
  status: "running" | "done" | "weak" | "fail";
  label: string;
  detail?: string;
  why?: string;
  evidence?: string;
  elapsedSec?: number;
};

export type ArtistDataPart = {
  id: string;
  name: string;
  imageUrl?: string;
  role?: "headliner" | "opener" | "alternate";
};

export type MapPinPart = {
  rank: number;
  name: string;
  lat: number;
  lon: number;
};

export type MapDataPart = {
  venue: { lat: number; lon: number };
  pins: MapPinPart[];
};

export type PitchPayload = {
  moodLine: string;
  headlinerWhy: string;
  openerWhy: string;
  crowdLine?: string;
  widenRoomNote?: string;
  alternates: Array<{ id: string; name: string; imageUrl?: string }>;
  headliner: {
    id: string;
    name: string;
    imageUrl?: string;
    background?: ArtistBackgroundCard;
  };
  opener: {
    id: string;
    name: string;
    imageUrl?: string;
    background?: ArtistBackgroundCard;
  } | null;
  neighborhoods: Array<{
    rank: number;
    name: string;
    km?: number;
    affinity?: number;
    lat?: number;
    lon?: number;
  }>;
  venueLabel: string;
  address: string;
  evidenceFootnotes: Record<string, string>;
};

export type AgentFinishSummary = {
  elapsedSec: number;
  qlooLookups: number;
  retries: number;
  quickMode?: boolean;
};

export type AgentSessionState = {
  pin?: VenuePin;
  band?: PopularityBand;
  tagIds: string[];
  tagLabels: string[];
  tagOperator: "union" | "intersection";
  headlinerId?: string;
  headlinerEntity?: { id: string; name: string; imageUrl?: string; popularity?: number };
  openerEntity?: { id: string; name: string; imageUrl?: string };
  neighborhoods: PitchPayload["neighborhoods"];
  crowdLine?: string;
  widenLevel: 0 | 1 | 2;
  tagDiscoveryCalls?: number;
  openerDiscoverCalls?: number;
  /** Set once scout_after_headliner has run, so the model can't redo its work. */
  extrasScouted?: boolean;
  alternateEntities?: PitchPayload["alternates"];
  refineUsed: Set<string>;
  knownTagIds: Set<string>;
  knownNames: Set<string>;
  knownIds: Set<string>;
  pitch?: PitchPayload;
  quickLineup?: LineupResult;
  artistBackgrounds?: Record<string, ArtistBackground>;
  artistResearchPending?: Map<
    string,
    { key: string; name: string; promise: Promise<ArtistBackground | null> }
  >;
  artistResearchLogged?: boolean;
  pitchValidationAttempts?: number;
  neighborhoodResolveMeta?: {
    usedTagHeatmap?: boolean;
    usedRingFallback?: boolean;
  };
};

export type StreamWriter = {
  writeStep: (part: StepDataPart) => void;
  writeArtist: (part: ArtistDataPart) => void;
  writeMap: (part: MapDataPart) => void;
  writePitch: (pitch: PitchPayload) => void;
  writeSummary: (summary: AgentFinishSummary) => void;
};
