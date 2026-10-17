import { describe, expect, it, vi } from "vitest";
import type { QlooEntity } from "@/lib/qloo/types";
import { pickOpener } from "@/lib/lineup/opener-select";

vi.mock("@/lib/lineup/artist-origin-sources", () => ({
  gatherArtistOriginTexts: vi.fn(async (name: string) => {
    if (name.includes("Outmarket")) return ["Tucson, Arizona"];
    if (name.includes("Atlantic")) {
      return ["Fixture Harbour, Atlantic Province, Canada"];
    }
    if (name.includes("Fixtureville")) {
      return ["Fixtureville, Ontario, Canada"];
    }
    if (name.includes("Local")) return ["Toronto, Ontario, Canada"];
    return ["Los Angeles, California"];
  }),
}));

vi.mock("@/lib/agent/research/actor-screen", () => ({
  isActorFirstByWikipedia: vi.fn(async () => false),
}));

describe("opener origin local check", () => {
  it("does not treat Qloo taste-in-city as local when origin is out of market", async () => {
    const headliner: QlooEntity = {
      name: "Fixture Headliner",
      entity_id: "head",
      popularity: 0.7,
      type: "artist",
      subtype: "urn:entity:artist",
      tags: [{ id: "urn:tag:genre:music:indie" }],
    };
    const candidates: QlooEntity[] = [
      {
        name: "Fixture Opener Outmarket Act",
        entity_id: "op",
        popularity: 0.55,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [{ id: "urn:tag:genre:music:indie" }],
      },
    ];
    const { opener, audit } = await pickOpener(
      candidates,
      headliner,
      "head",
      {
        lat: 34.09,
        lon: -118.28,
        city: "Los Angeles",
        suburb: "Silver Lake",
      },
      ["urn:tag:genre:music:indie"],
    );
    expect(opener).toBeNull();
    expect(audit[0]?.reason).toBe("origin outside venue city or borough");
  });

  it("does not pick a same-country opener from another city (Toronto venue)", async () => {
    const headliner: QlooEntity = {
      name: "Fixture Headliner",
      entity_id: "head",
      popularity: 0.7,
      type: "artist",
      subtype: "urn:entity:artist",
      tags: [{ id: "urn:tag:genre:music:indie" }],
    };
    const candidates: QlooEntity[] = [
      {
        name: "Fixture Opener Atlantic Act",
        entity_id: "op",
        popularity: 0.55,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [{ id: "urn:tag:genre:music:indie" }],
      },
    ];
    const { opener } = await pickOpener(
      candidates,
      headliner,
      "head",
      { lat: 43.65, lon: -79.38, city: "Toronto", suburb: "Queen West" },
      ["urn:tag:genre:music:indie"],
    );
    expect(opener).toBeNull();
  });

  it("does not treat a fictional out-of-market act as local in Fixtureton", async () => {
    const headliner: QlooEntity = {
      name: "Fixture Headliner",
      entity_id: "head",
      popularity: 0.7,
      type: "artist",
      subtype: "urn:entity:artist",
      tags: [{ id: "urn:tag:genre:music:indie" }],
    };
    const { opener } = await pickOpener(
      [
        {
          name: "Fixture Opener From Fixtureville",
          entity_id: "op",
          popularity: 0.55,
          type: "artist",
          subtype: "urn:entity:artist",
          tags: [{ id: "urn:tag:genre:music:indie" }],
        },
      ],
      headliner,
      "head",
      { lat: 43.65, lon: -79.38, city: "Fixtureton", suburb: "Fixture Heights" },
      ["urn:tag:genre:music:indie"],
    );
    expect(opener).toBeNull();
  });
});
