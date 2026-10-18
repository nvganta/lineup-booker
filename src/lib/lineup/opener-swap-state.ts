import type { PitchPayload } from "@/lib/agent/types";
import { humanOpenerPickReason } from "@/lib/lineup/opener-reason-copy";

function openerWhyForAct(pitch: PitchPayload, actId: string, reason: string): string {
  return (
    pitch.meta?.openerPickLinesByActId?.[actId]?.trim() ||
    humanOpenerPickReason(reason)
  );
}

export type OpenerSwapInput = {
  pitch: PitchPayload;
  swapNext: NonNullable<PitchPayload["openerSwapQueue"]>[number];
};

/** Pure swap transition for tests and UI. */
export function applyOpenerSwap({ pitch, swapNext }: OpenerSwapInput): PitchPayload {
  if (!pitch.opener) return pitch;
  const prevOpener = pitch.opener;
  const prevEntry = pitch.openerSwapQueue?.find((q) => q.id === prevOpener.id);
  return {
    ...pitch,
    opener: {
      id: swapNext.id,
      name: swapNext.name,
      imageUrl: swapNext.imageUrl,
      background: pitch.opener.background,
    },
    openerWhy: openerWhyForAct(pitch, swapNext.id, swapNext.reason),
    meta: {
      ...pitch.meta,
      openerPopularity: swapNext.popularity ?? pitch.meta?.openerPopularity,
      openerOriginMatchesCity:
        pitch.meta?.openerOriginByActId?.[swapNext.id] === true,
    },
    openerSwapQueue: [
      {
        id: prevOpener.id,
        name: prevOpener.name,
        imageUrl: prevOpener.imageUrl,
        reason:
          prevEntry?.reason ??
          pitch.openerSwapQueue?.[0]?.reason ??
          swapNext.reason,
        popularity: pitch.meta?.openerPopularity,
      },
      ...(pitch.openerSwapQueue ?? []).filter((q) => q.id !== swapNext.id),
    ],
  };
}
