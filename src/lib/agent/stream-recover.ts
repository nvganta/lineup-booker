import type { LineupRequest } from "@/lib/lineup/schemas";
import type { LineupResult } from "@/lib/lineup/build-lineup";
import type { AgentStreamState } from "./consume-agent-stream";
import type { PitchPayload } from "./types";

export function agentStreamHasTerminalEvent(state: AgentStreamState): boolean {
  return Boolean(state.pitch) || Boolean(state.summary);
}

function pitchFromLineupResult(
  input: LineupRequest,
  lineup: LineupResult,
): PitchPayload {
  return {
    venueLabel: lineup.venueLabel,
    address: input.location,
    moodLine: "A live night sized for your room.",
    headlinerWhy: `${lineup.headliner.name} is the right size for this room and in the lane your regulars love.`,
    openerWhy: lineup.opener
      ? `${lineup.opener.name} opens in the same lane.`
      : "No local opener stood out this time.",
    headliner: {
      id: lineup.headliner.id,
      name: lineup.headliner.name,
      imageUrl: lineup.headliner.imageUrl,
    },
    opener: lineup.opener
      ? {
          id: lineup.opener.id,
          name: lineup.opener.name,
          imageUrl: lineup.opener.imageUrl,
        }
      : null,
    alternates: lineup.alternates.map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
    })),
    neighborhoods: lineup.neighborhoods.map((n) => ({
      rank: n.rank,
      name: n.name,
      lat: n.lat,
      lon: n.lon,
    })),
    evidenceFootnotes: {
      mode: "Quick mode after an interrupted scout.",
    },
  };
}

/** Build a pitch from streamed scout parts when the agent never composed one. */
export function salvagePitchFromStreamState(
  state: AgentStreamState,
  input: LineupRequest,
): PitchPayload | null {
  const headliner = state.artists.find((a) => a.role === "headliner");
  if (!headliner) return null;
  const pins = state.map?.pins ?? [];
  if (pins.length < 2) return null;
  const opener = state.artists.find((a) => a.role === "opener");
  return {
    venueLabel: input.concept.trim() || "Venue",
    address: input.location,
    moodLine: "A live night sized for your room.",
    headlinerWhy: `${headliner.name} is the right size for this room and in the lane your regulars love.`,
    openerWhy: opener
      ? `${opener.name} opens in the same lane.`
      : "No local opener stood out this time.",
    headliner: { id: headliner.id, name: headliner.name, imageUrl: headliner.imageUrl },
    opener: opener
      ? { id: opener.id, name: opener.name, imageUrl: opener.imageUrl }
      : null,
    alternates: state.artists
      .filter((a) => a.role === "alternate")
      .map((a) => ({ id: a.id, name: a.name, imageUrl: a.imageUrl })),
    neighborhoods: pins.map((p) => ({
      rank: p.rank,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
    })),
    evidenceFootnotes: { mode: "Salvaged from an interrupted scout." },
  };
}

export async function fetchQuickLineupPitch(
  input: LineupRequest,
): Promise<PitchPayload | null> {
  const res = await fetch("/api/lineup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { lineup?: LineupResult };
  if (!json.lineup) return null;
  return pitchFromLineupResult(input, json.lineup);
}

export async function recoverIncompleteAgentStream(
  partial: AgentStreamState,
  input: LineupRequest,
  onUpdate: (state: AgentStreamState) => void,
): Promise<AgentStreamState> {
  const state: AgentStreamState = {
    ...partial,
    steps: [...partial.steps],
    artists: [...partial.artists],
  };

  const salvaged = salvagePitchFromStreamState(state, input);
  if (salvaged) {
    state.pitch = salvaged;
    state.summary = {
      elapsedSec: 0,
      qlooLookups: 0,
      retries: 0,
      quickMode: false,
    };
    onUpdate({ ...state, steps: [...state.steps], artists: [...state.artists] });
    return state;
  }

  const quickPitch = await fetchQuickLineupPitch(input);
  if (quickPitch) {
    state.pitch = quickPitch;
    state.summary = {
      elapsedSec: 0,
      qlooLookups: 0,
      retries: 0,
      quickMode: true,
    };
    onUpdate({ ...state, steps: [...state.steps], artists: [...state.artists] });
    return state;
  }

  return state;
}

export function emptyAgentStreamState(): AgentStreamState {
  return { steps: [], artists: [] };
}

export type AgentStreamConsumeResult = {
  state: AgentStreamState;
  terminal: boolean;
};
