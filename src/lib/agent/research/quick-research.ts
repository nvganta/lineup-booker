import type { PitchPayload } from "../types";
import type { ArtistResearchInput } from "./types";
import { RESEARCH_TOTAL_MS } from "./types";
import { researchArtists } from "./research-artists";
import { applyArtistBackgroundsToPitch } from "./apply-pitch";

export async function enrichPitchWithArtistResearch(
  pitch: PitchPayload,
  inputs: ArtistResearchInput[],
): Promise<PitchPayload> {
  if (!inputs.length) return pitch;
  const backgrounds = await Promise.race([
    researchArtists(inputs),
    new Promise<Record<string, import("./types").ArtistBackground>>((resolve) =>
      setTimeout(() => resolve({}), RESEARCH_TOTAL_MS),
    ),
  ]);
  return applyArtistBackgroundsToPitch(pitch, backgrounds);
}
