import { getCachedArtistBackground } from "@/lib/agent/research/cache";
import { researchOneArtist } from "@/lib/agent/research/research-artists";
import type { ArtistResearchHints } from "@/lib/agent/research/types";
import { originFromExtract } from "@/lib/agent/research/wikipedia";

function normalizeOrigin(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function originFromKnownForLine(knownFor: string): string | undefined {
  const trimmed = knownFor.trim();
  const fromPrefix = trimmed.match(/^From\s+(.+?)(?:[,.]|$)/i);
  if (fromPrefix?.[1]) return normalizeOrigin(fromPrefix[1]);
  return originFromExtract(trimmed);
}

/** Collect origin locality strings from the same sources as the research card. */
export async function gatherArtistOriginTexts(
  artistName: string,
  hints: ArtistResearchHints | undefined,
  entityId?: string,
): Promise<string[]> {
  const found = new Set<string>();

  const push = (raw: string | undefined) => {
    if (!raw?.trim()) return;
    found.add(normalizeOrigin(raw));
  };

  if (hints?.description) {
    push(originFromExtract(hints.description));
  }

  const background =
    (await getCachedArtistBackground(artistName, entityId)) ??
    (await researchOneArtist({ name: artistName, id: entityId, hints }));

  if (background) {
    push(background.origin);
    push(originFromKnownForLine(background.knownFor ?? ""));
    push(originFromExtract(background.knownFor ?? ""));
  }

  return [...found];
}
