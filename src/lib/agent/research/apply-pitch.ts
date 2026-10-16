import type { ArtistBackgroundCard, PitchPayload } from "../types";
import type { ArtistBackground } from "./types";
import { formatBackgroundLine } from "./research-artists";

function cardFromBackground(bg: ArtistBackground): ArtistBackgroundCard {
  return {
    line: formatBackgroundLine(bg),
    sourceName: bg.sourceName,
    sourceUrl: bg.sourceUrl,
  };
}

export function applyArtistBackgroundsToPitch(
  pitch: PitchPayload,
  backgrounds: Record<string, ArtistBackground>,
): PitchPayload {
  const headlinerBg =
    backgrounds[pitch.headliner.id] ?? backgrounds[pitch.headliner.name];
  const openerBg = pitch.opener
    ? backgrounds[pitch.opener.id] ?? backgrounds[pitch.opener.name]
    : undefined;

  return {
    ...pitch,
    headliner: {
      ...pitch.headliner,
      background: headlinerBg ? cardFromBackground(headlinerBg) : undefined,
    },
    opener: pitch.opener
      ? {
          ...pitch.opener,
          background: openerBg ? cardFromBackground(openerBg) : undefined,
        }
      : null,
  };
}
