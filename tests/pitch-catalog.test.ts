import { describe, expect, it } from "vitest";
import {
  assemblePitchWhyLines,
  fallbackMoodLine,
  regularsStylesPhrase,
  buildPitchWhyCatalog,
} from "@/lib/agent/pitch-catalog";
import type { AgentSessionState } from "@/lib/agent/types";

describe("buildPitchWhyCatalog", () => {
  it("assembles only from chosen slot ids", () => {
    const session = {
      headlinerEntity: { id: "h1", name: "Fixture Alpha" },
      openerEntity: { id: "o1", name: "Fixture Beta" },
      tagLabels: ["indie folk"],
      neighborhoods: [{ rank: 1, name: "Fixture Heights" }],
    } as AgentSessionState;
    const catalog = buildPitchWhyCatalog(session);
    const out = assemblePitchWhyLines(catalog, "room_and_tags", "local_support");
    expect(out?.headlinerWhy).toContain("Fixture Alpha");
    expect(out?.openerWhy).toContain("Fixture Beta");
    expect(assemblePitchWhyLines(catalog, "not_a_slot", "local_support")).toBeNull();
  });
});

describe("slot copy", () => {
  it("reads as a sentence, without tool words or a repeated bio", () => {
    const session = {
      headlinerEntity: { id: "h1", name: "Fixture Alpha" },
      openerEntity: { id: "o1", name: "Fixture Beta" },
      tagLabels: ["Indie Rock", "Dream Pop"],
      neighborhoods: [
        { rank: 1, name: "Fixture Heights" },
        { rank: 2, name: "Fixture Flats" },
      ],
    } as AgentSessionState;
    const catalog = buildPitchWhyCatalog(session);
    const all = [
      ...Object.values(catalog.headlinerWhy),
      ...Object.values(catalog.openerWhy),
    ].join(" ");
    expect(all).not.toMatch(/\btags?\b|signal|scout/i);
    expect(catalog.headlinerWhy.room_and_tags).toContain("indie rock and dream pop");
    expect(catalog.headlinerSlotIds).not.toContain("public_bio");
  });
});

describe("styles phrase", () => {
  it("drops styles already covered and picks the right article", () => {
    const session = {
      headlinerEntity: { id: "h1", name: "Fixture Alpha" },
      tagLabels: ["Indie Folk", "Folk", "Folk & Indie"],
      neighborhoods: [],
    } as unknown as AgentSessionState;
    expect(regularsStylesPhrase(session)).toBe("indie folk");
    expect(fallbackMoodLine(session)).toBe("An indie folk night sized for your room.");
  });
});

describe("style spelling", () => {
  it("writes compound styles the way people do", () => {
    const session = {
      headlinerEntity: { id: "h1", name: "Fixture Alpha" },
      tagLabels: ["Singer Songwriters", "Post Punk"],
      neighborhoods: [],
    } as unknown as AgentSessionState;
    expect(regularsStylesPhrase(session)).toBe("singer-songwriter and post-punk");
  });
});

describe("plain mood line passes the fact check", () => {
  it("fallback mood line has no subjective praise", async () => {
    const { validatePitchPayload } = await import("@/lib/agent/pitch-validator");
    const session = {
      headlinerEntity: { id: "h1", name: "Fixture Alpha" },
      tagLabels: ["Singer Songwriters", "Smooth Jazz"],
      neighborhoods: [],
    } as unknown as AgentSessionState;
    const pitch = {
      venueLabel: "Fixture Room",
      address: "1 Fixture St",
      moodLine: fallbackMoodLine(session),
      headlinerWhy: "",
      openerWhy: "",
      headliner: { id: "h1", name: "Fixture Alpha" },
      opener: null,
      alternates: [],
      neighborhoods: [],
    } as unknown as Parameters<typeof validatePitchPayload>[0];
    expect(validatePitchPayload(pitch).ok).toBe(true);
  });
});

describe("run-together tag names", () => {
  it("does not repeat indie folk as 'folk indiefolk'", () => {
    const session = {
      headlinerEntity: { id: "h1", name: "Fixture Alpha" },
      tagLabels: ["Indie Folk", "Folk", "Folk Indiefolk", "Folk Indie Pop", "Chamber Pop"],
      neighborhoods: [],
    } as unknown as AgentSessionState;
    expect(regularsStylesPhrase(session)).toBe("indie folk and chamber pop");
  });
});
