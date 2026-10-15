import { describe, expect, it } from "vitest";
import type { QlooEntity } from "@/lib/qloo/types";
import {
  filterMusicArtists,
  hasGenreConflictForRoom,
  isMusicArtist,
  isPersonOnlyEntity,
  meaningfulGenreOverlap,
  pickHeadliner,
  rankHeadlinerCandidates,
} from "@/lib/lineup/artist-filter";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";

const INDIE_TAGS = [
  "urn:tag:genre:music:indie_rock",
  "urn:tag:genre:music:dream_pop",
];

const BAR_TAGS = [
  "urn:tag:genre:music:electronic",
  "urn:tag:genre:music:soul",
  "urn:tag:genre:music:jazz",
];

const FOLK_TAGS = [
  "urn:tag:genre:music:indie_folk",
  "urn:tag:genre:music:folk",
];

function qlooShapedArtist(
  name: string,
  musicTagIds: string[],
  extraTags: string[] = [],
  popularity = 0.82,
): QlooEntity {
  const tagObjects = [
    ...musicTagIds.map((id) => ({ id })),
    ...extraTags.map((id) => ({ id })),
  ];
  const fillerCount = Math.max(0, 45 - tagObjects.length);
  for (let i = 0; i < fillerCount; i += 1) {
    tagObjects.push({ id: `urn:tag:genre:place:synthetic_noise_${i}` });
  }
  return {
    name,
    subtype: "urn:entity:artist",
    popularity,
    tags: tagObjects,
  };
}

describe("trust Qloo genre ranking", () => {
  it("keeps artists with generic indie tags when Qloo ranked them", () => {
    const artist: QlooEntity = {
      name: "Fixture Indie Artist",
      subtype: "urn:entity:artist",
      popularity: 0.84,
      tags: [
        { id: "urn:tag:genre:music:indie" },
        { id: "urn:tag:genre:music:rock" },
      ],
    };
    expect(isMusicArtist(artist, INDIE_TAGS)).toBe(true);
    expect(filterMusicArtists([artist], INDIE_TAGS)).toHaveLength(1);
  });

  it("passes Qloo-shaped indie folk artists with sparse music tags among many tags", () => {
    const indieFolk = qlooShapedArtist("Fixture Indie Folk Act", [
      "urn:tag:genre:music:indie_folk",
      "urn:tag:genre:music:folk",
      "urn:tag:genre:music:indie",
      "urn:tag:genre:music:singer_songwriter",
    ]);
    expect(isMusicArtist(indieFolk, FOLK_TAGS)).toBe(true);
    expect(filterMusicArtists([indieFolk], FOLK_TAGS)).toHaveLength(1);
    expect(pickHeadliner([indieFolk], FOLK_TAGS)?.name).toBe(
      "Fixture Indie Folk Act",
    );
  });
});

describe("non-musicians blocked", () => {
  it("rejects person/celebrity entities without music genre tags", () => {
    const celebrity: QlooEntity = {
      name: "Fixture Fashion Person",
      subtype: "urn:entity:person",
      type: "person",
      tags: [{ id: "urn:tag:genre:place:fashion" }],
    };
    expect(isPersonOnlyEntity(celebrity)).toBe(true);
    expect(isMusicArtist(celebrity, INDIE_TAGS)).toBe(false);
  });

  it("rejects artists with no music genre tags", () => {
    const burlesque: QlooEntity = {
      name: "Fixture Burlesque Act",
      subtype: "urn:entity:artist",
      tags: [{ id: "urn:tag:genre:place:burlesque" }],
    };
    expect(isMusicArtist(burlesque, INDIE_TAGS)).toBe(false);
  });

  it("rejects celebrities with a token music tag but dominant TV/model tags", () => {
    const modelAct = qlooShapedArtist(
      "Fixture Model Act",
      ["urn:tag:genre:music:pop"],
      [
        "urn:tag:genre:person:model",
        "urn:tag:genre:person:actress",
        "urn:tag:genre:media:television",
      ],
    );
    const tvAct = qlooShapedArtist(
      "Fixture TV Act",
      ["urn:tag:genre:music:pop"],
      [
        "urn:tag:genre:media:television",
        "urn:tag:genre:media:reality",
      ],
    );
    expect(isMusicArtist(modelAct, INDIE_TAGS)).toBe(false);
    expect(isMusicArtist(tvAct, INDIE_TAGS)).toBe(false);
    expect(filterMusicArtists([modelAct, tvAct], INDIE_TAGS)).toHaveLength(0);
  });

  it("keeps musicians with discography evidence despite sparse genre tags", () => {
    const working: QlooEntity = {
      name: "Working Musician",
      subtype: "urn:entity:artist",
      tags: [{ id: "urn:tag:genre:music:indie_folk" }],
      properties: { discography: [{ title: "Album One" }] },
    };
    expect(isMusicArtist(working, INDIE_TAGS)).toBe(true);
  });
});

describe("hasGenreConflictForRoom", () => {
  it("rejects metal-heavy artists for indie folk requests", () => {
    const metalAct: QlooEntity = {
      name: "Fixture Metal Act",
      subtype: "urn:entity:artist",
      tags: [
        { id: "urn:tag:genre:music:heavy_metal" },
        { id: "urn:tag:genre:music:metal" },
        { id: "urn:tag:genre:music:hard_rock" },
      ],
    };
    expect(hasGenreConflictForRoom(metalAct, INDIE_TAGS)).toBe(true);
    expect(isMusicArtist(metalAct, INDIE_TAGS)).toBe(false);
  });
});

describe("pickHeadliner popularity and genre overlap", () => {
  it("prefers acts within small-room cap for 250 capacity", () => {
    const band = popularityBandFromConcept("250 capacity wine bar");
    expect(band.headlinerMax).toBe(0.85);

    const artists: QlooEntity[] = [
      {
        name: "Fixture Arena DJ",
        subtype: "urn:entity:artist",
        popularity: 0.935,
        tags: [{ id: "urn:tag:genre:music:electronic" }],
      },
      {
        name: "Fixture Mid Tier DJ",
        subtype: "urn:entity:artist",
        popularity: 0.78,
        tags: [
          { id: "urn:tag:genre:music:soul" },
          { id: "urn:tag:genre:music:electronic" },
        ],
      },
    ];

    expect(
      pickHeadliner(artists, BAR_TAGS, band)?.name,
    ).toBe("Fixture Mid Tier DJ");
  });

  it("rejects arena-scale acts with weak genre overlap for small rooms", () => {
    const band = popularityBandFromConcept("250 capacity bar");
    const arenaAct: QlooEntity = {
      name: "Fixture Arena Singer",
      subtype: "urn:entity:artist",
      popularity: 0.95,
      tags: [{ id: "urn:tag:genre:music:indie_rock" }],
    };
    expect(meaningfulGenreOverlap(arenaAct, BAR_TAGS)).toBe(false);
    expect(pickHeadliner([arenaAct], BAR_TAGS, band)).toBeUndefined();
    expect(rankHeadlinerCandidates([arenaAct], BAR_TAGS, band)).toHaveLength(0);
  });

  it("drops alternates above the venue popularity cap even with genre overlap", () => {
    const band = popularityBandFromConcept("150 capacity room");
    const bigAct = qlooShapedArtist(
      "Fixture Big Room Act",
      [
        "urn:tag:genre:music:soul",
        "urn:tag:genre:music:jazz",
        "urn:tag:genre:music:electronic",
      ],
      [],
      0.95,
    );
    expect(rankHeadlinerCandidates([bigAct], BAR_TAGS, band)).toHaveLength(0);
  });
});
