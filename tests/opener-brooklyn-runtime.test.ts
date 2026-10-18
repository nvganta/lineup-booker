import { describe, expect, it, vi } from "vitest";
import type { QlooEntity } from "@/lib/qloo/types";
import {
  evaluateOpenerLocalEvidence,
  pickOpener,
} from "@/lib/lineup/opener-select";

const brooklynPin = {
  lat: 40.7,
  lon: -73.95,
  city: "Brooklyn",
  displayCity: "New York",
  state: "New York",
  borough: "Brooklyn",
  county: "Kings County",
};

vi.mock("@/lib/lineup/artist-origin-sources", () => ({
  gatherArtistOriginTexts: vi.fn(async (name: string) => {
    if (name.includes("Fixture Boyd")) {
      return [
        "a novel by Fixture Author",
        "Brooklyn, New York City",
      ];
    }
    if (name.includes("Fixture Junk")) {
      return ["a novel by Fixture Author"];
    }
    return ["Los Angeles, California"];
  }),
}));

vi.mock("@/lib/agent/research/actor-screen", () => ({
  isActorFirstByWikipedia: vi.fn(async () => false),
}));

describe("Brooklyn opener origin runtime path", () => {
  it("accepts when any scraped origin matches the venue metro", async () => {
    const candidate: QlooEntity = {
      name: "Fixture Boyd Act",
      entity_id: "boyd",
      popularity: 0.55,
      type: "artist",
      subtype: "urn:entity:artist",
      tags: [{ id: "urn:tag:genre:music:indie" }],
    };
    const result = await evaluateOpenerLocalEvidence(candidate, brooklynPin);
    expect(result.ok).toBe(true);
    expect(result.originMatch).toBe(true);
  });

  it("pickOpener keeps a Brooklyn act when junk origin is filtered out", async () => {
    const headliner: QlooEntity = {
      name: "Fixture Headliner",
      entity_id: "head",
      popularity: 0.7,
      type: "artist",
      subtype: "urn:entity:artist",
      tags: [{ id: "urn:tag:genre:music:indie" }],
    };
    const { opener, audit } = await pickOpener(
      [
        {
          name: "Fixture Boyd Opener",
          entity_id: "boyd-op",
          popularity: 0.55,
          type: "artist",
          subtype: "urn:entity:artist",
          tags: [{ id: "urn:tag:genre:music:indie" }],
        },
      ],
      headliner,
      "head",
      brooklynPin,
      ["urn:tag:genre:music:indie"],
    );
    expect(opener?.name).toContain("Fixture Boyd");
    expect(audit[0]?.kept).toBe(true);
  });

  it("treats only junk origins as no specific origin", async () => {
    const candidate: QlooEntity = {
      name: "Fixture Junk Act",
      entity_id: "junk",
      popularity: 0.55,
      type: "artist",
      subtype: "urn:entity:artist",
      tags: [{ id: "urn:tag:genre:music:indie" }],
    };
    const result = await evaluateOpenerLocalEvidence(candidate, brooklynPin);
    expect(result.ok).toBe(true);
    expect(result.reason).toContain("no origin on file");
  });
});
