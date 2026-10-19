import { describe, expect, it } from "vitest";
import type { QlooEntity } from "@/lib/qloo/types";
import {
  filterMusicArtists,
  isMusicArtist,
  isNonPerformerProfile,
} from "@/lib/lineup/artist-filter";

const tag = (id: string) => ({ id, type: id.split(":").slice(0, -1).join(":") });

const host: QlooEntity = {
  entity_id: "fixture-host",
  name: "Fixture Host",
  subtype: "urn:entity:artist",
  popularity: 0.6,
  properties: { short_description: "Testland television and radio personality known for interviews." },
  tags: [
    tag("urn:tag:genre:music:indie"),
    tag("urn:tag:style:qloo:conversational"),
    tag("urn:tag:characteristic:qloo:articulate"),
  ],
};

const singer: QlooEntity = {
  entity_id: "fixture-singer",
  name: "Fixture Singer",
  subtype: "urn:entity:artist",
  popularity: 0.5,
  properties: { short_description: "Testland singer-songwriter blending folk and rock." },
  tags: [
    tag("urn:tag:genre:music:indie_rock"),
    tag("urn:tag:music:qloo:soulful"),
    tag("urn:tag:instrument:qloo:guitar"),
    tag("urn:tag:style:qloo:energetic"),
  ],
};

describe("non-performer profiles", () => {
  it("drops a host filed as an artist and keeps a real act", () => {
    expect(isNonPerformerProfile(host)).toBe(true);
    expect(isMusicArtist(host)).toBe(false);
    expect(isNonPerformerProfile(singer)).toBe(false);
    expect(isMusicArtist(singer)).toBe(true);
    expect(filterMusicArtists([host, singer], []).map((e) => e.name)).toEqual(["Fixture Singer"]);
  });

  it("uses the tags when there is no description", () => {
    const noDesc: QlooEntity = { ...host, properties: {} };
    expect(isNonPerformerProfile(noDesc)).toBe(true);
  });

  it("keeps a sparsely tagged act with only genre tags", () => {
    const sparse: QlooEntity = { ...singer, properties: {}, tags: [tag("urn:tag:genre:music:folk")] };
    expect(isNonPerformerProfile(sparse)).toBe(false);
  });

  it("keeps a radio host who is also described as a musician", () => {
    const both: QlooEntity = {
      ...singer,
      properties: { short_description: "Radio host and musician from Testland." },
    };
    expect(isNonPerformerProfile(both)).toBe(false);
  });
});
