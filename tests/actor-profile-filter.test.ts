import { describe, expect, it } from "vitest";
import { isMusicArtist, isPrimarilyActorProfile } from "@/lib/lineup/artist-filter";
import type { QlooEntity } from "@/lib/qloo/types";

function fixtureArtist(tags: string[]): QlooEntity {
  return {
    entity_id: "fixture-celeb",
    name: "Fixture Celeb",
    subtype: "urn:entity:artist",
    type: "artist",
    tags: tags.map((id) => ({ id, name: id.split(":").pop() ?? id })),
  };
}

describe("primarily actor profiles", () => {
  it("flags actress-first Qloo rows for the bench", () => {
    const entity = fixtureArtist([
      "urn:tag:genre:media:music:pop",
      "urn:tag:career:actress",
      "urn:tag:career:television",
    ]);
    expect(isPrimarilyActorProfile(entity)).toBe(true);
    expect(isMusicArtist(entity, ["urn:tag:genre:media:music:indie_folk"])).toBe(
      false,
    );
  });

  it("keeps musicians with real discography evidence", () => {
    const entity = fixtureArtist([
      "urn:tag:genre:media:music:folk",
      "urn:tag:career:actress",
    ]);
    entity.properties = { album_count: 3 };
    expect(isPrimarilyActorProfile(entity)).toBe(false);
    expect(isMusicArtist(entity, ["urn:tag:genre:media:music:folk"])).toBe(true);
  });
});
