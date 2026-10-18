import { describe, expect, it } from "vitest";
import { buildPitchMetaFromSession } from "@/lib/agent/pitch-meta";
import { validatePitchPayload } from "@/lib/agent/pitch-validator";
import type { AgentSessionState, PitchPayload } from "@/lib/agent/types";
import { formatCrowdDisplay } from "@/lib/lineup/crowd-display";

describe("agent pitch with demographics", () => {
  it("does not fail validation when crowd lives in structured demographics only", () => {
    const demographics = {
      age: { "35_to_44": 0.7 },
      gender: { male: 0.42, female: 0.58 },
    };
    const session: AgentSessionState = {
      tagIds: ["tag-indie"],
      tagLabels: ["Indie folk"],
      tagOperator: "union",
      neighborhoods: [{ rank: 1, name: "Fixture Quarter" }],
      widenLevel: 0,
      refineUsed: new Set(),
      knownTagIds: new Set(),
      knownNames: new Set(),
      knownIds: new Set(),
      crowdDemographics: demographics,
      headlinerEntity: {
        id: "act-headliner",
        name: "Fixture Headliner",
        popularity: 0.55,
      },
      pin: {
        lat: 51.52,
        lon: -0.08,
        city: "London",
        displayCity: "London",
      },
    };

    const pitch: PitchPayload = {
      venueLabel: "Fixture wine bar",
      address: "100 Fixture High St, London",
      moodLine: "Fixture Headliner fits a late set for your room.",
      headlinerWhy: "Fixture Headliner matches the styles your regulars named.",
      openerWhy: "Fixture Opener opens in the same lane.",
      crowdDemographics: session.crowdDemographics,
      headliner: session.headlinerEntity!,
      opener: {
        id: "act-opener",
        name: "Fixture Opener",
      },
      alternates: [],
      neighborhoods: session.neighborhoods,
      meta: buildPitchMetaFromSession(session, {
        concept: "Fixture wine bar",
        location: "100 Fixture High St, London",
        regularsLove: "indie folk",
      }),
      evidenceFootnotes: {},
    };

    expect(formatCrowdDisplay(demographics)).toBe(
      "Skews 35–44 · leans female",
    );
    const validation = validatePitchPayload(pitch, ["London", "Fixture Quarter"]);
    expect(validation.ok).toBe(true);
  });
});
