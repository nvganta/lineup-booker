import type {
  AgentFinishSummary,
  ArtistDataPart,
  MapDataPart,
  PitchPayload,
  StepDataPart,
} from "./types";

export type AgentStreamState = {
  steps: StepDataPart[];
  artists: ArtistDataPart[];
  map?: MapDataPart;
  pitch?: PitchPayload;
  summary?: AgentFinishSummary;
};

export function createAgentStreamState(): AgentStreamState {
  return { steps: [], artists: [] };
}

function applyChunk(state: AgentStreamState, chunk: unknown): void {
  if (!chunk || typeof chunk !== "object") return;
  const c = chunk as { type?: string; data?: unknown; id?: string };
  if (c.type === "data-step" && c.data) {
    const step = c.data as StepDataPart;
    const idx = state.steps.findIndex((s) => s.id === step.id);
    if (idx >= 0) state.steps[idx] = step;
    else state.steps.push(step);
  }
  if (c.type === "data-artist" && c.data) {
    const artist = c.data as ArtistDataPart;
    const idx = state.artists.findIndex((a) => a.id === artist.id);
    if (idx >= 0) state.artists[idx] = artist;
    else state.artists.push(artist);
  }
  if (c.type === "data-map" && c.data) {
    state.map = c.data as MapDataPart;
  }
  if (c.type === "data-pitch" && c.data) {
    state.pitch = c.data as PitchPayload;
  }
  if (c.type === "data-summary" && c.data) {
    state.summary = c.data as AgentFinishSummary;
  }
}

export async function consumeAgentStream(
  response: Response,
  onUpdate: (state: AgentStreamState) => void,
): Promise<AgentStreamState> {
  const state = createAgentStreamState();
  if (!response.body) return state;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as unknown;
        if (Array.isArray(json)) {
          for (const item of json) applyChunk(state, item);
        } else {
          applyChunk(state, json);
        }
        onUpdate({ ...state, steps: [...state.steps], artists: [...state.artists] });
      } catch {
        // ignore partial SSE frames
      }
    }
  }
  return state;
}
