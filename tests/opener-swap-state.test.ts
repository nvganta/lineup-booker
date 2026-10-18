import { describe, expect, it } from "vitest";
import { applyOpenerSwap } from "@/lib/lineup/opener-swap-state";
import type { PitchPayload } from "@/lib/agent/types";
import { mergeWhyLinesByActId, whyLineForAct } from "@/lib/lineup/act-why-cache";

const twinId = "act-twin";
const davidId = "act-david";

function basePitch(): PitchPayload {
  return {
    venueLabel: "Fixture bar",
    address: "1 Main St",
    moodLine: "A night for the room.",
    headlinerWhy: "",
    openerWhy: "Local act whose origin matches this city.",
    headliner: { id: "act-head", name: "Fixture Headliner" },
    opener: { id: twinId, name: "Fixture Twin" },
    alternates: [],
    neighborhoods: [],
    evidenceFootnotes: {},
    openerSwapQueue: [
      {
        id: davidId,
        name: "Fixture David",
        reason: "origin matches venue",
        popularity: 0.69,
      },
    ],
    meta: {
      openerPopularity: 0.62,
      openerPickLinesByActId: {
        [twinId]:
          "Fixture Twin fits the room's opener draw — below Fixture Headliner in listener reach.",
        [davidId]:
          "Fixture David is a local act in the same lane, an easy warm-up for Fixture Headliner.",
      },
    },
  };
}

describe("applyOpenerSwap", () => {
  it("swap then swap back restores opener id for why cache lookup", () => {
    let pitch = basePitch();
    const cache = mergeWhyLinesByActId(
      {},
      {
        acts: [
          {
            id: twinId,
            name: "Fixture Twin",
            localAffinity: null,
            nationalAffinity: null,
            whyLine: "About 62nd percentile globally for listener reach.",
          },
          {
            id: davidId,
            name: "Fixture David",
            localAffinity: null,
            nationalAffinity: null,
            whyLine: "About 69th percentile globally for listener reach.",
          },
        ],
        openerOverlap: { value: null, label: "n/a", method: "unavailable" },
        venueTags: [],
        demographics: null,
        crowdLine: null,
        openerShowLocalBadge: false,
      },
    );

    expect(whyLineForAct(cache, pitch.opener!.id)).toContain("62nd");

    pitch = applyOpenerSwap({
      pitch,
      swapNext: pitch.openerSwapQueue![0]!,
    });
    expect(pitch.opener!.id).toBe(davidId);

    pitch = applyOpenerSwap({
      pitch,
      swapNext: pitch.openerSwapQueue![0]!,
    });
    expect(pitch.opener!.id).toBe(twinId);
    expect(whyLineForAct(cache, pitch.opener!.id)).toContain("62nd");
    expect(pitch.openerWhy).toContain("listener reach");
  });
});
