import { describe, expect, it } from "vitest";
import {
  compareTasteCounts,
  toNearSpots,
  type PlaceRow,
} from "@/lib/venue/place-insights";
import {
  draftProblems,
  nearDuplicate,
  parseDraft,
  templateDraft,
  type DraftInput,
} from "@/lib/venue/drafted-copy";
import { typedVenueLabel } from "@/lib/lineup/venue-display";

function place(id: string, tags: Array<[string, string]>, address?: string): PlaceRow {
  return {
    id,
    name: `Fixture Place ${id}`,
    address,
    tags: tags.map(([type, name]) => ({ type: `urn:tag:${type}`, name })),
  };
}

const BEER: [string, string] = ["beverage_offering:qloo", "Craft beer"];
const LATE: [string, string] = ["time_of_day_fit:qloo", "Late night"];
const SEAFOOD: [string, string] = ["cuisine:qloo", "Seafood"];
const PARK: [string, string] = ["genre:place", "Park"];
const BAR: [string, string] = ["genre:place", "Cocktail bar"];

describe("compareTasteCounts", () => {
  it("returns plain counts with the biggest gaps first", () => {
    const fans = [
      ...Array.from({ length: 6 }, (_, i) => place(`f${i}`, [BEER, LATE])),
      ...Array.from({ length: 4 }, (_, i) => place(`g${i}`, [SEAFOOD])),
    ];
    const city = [
      ...Array.from({ length: 2 }, (_, i) => place(`c${i}`, [BEER])),
      ...Array.from({ length: 8 }, (_, i) => place(`d${i}`, [SEAFOOD])),
    ];
    const rows = compareTasteCounts(fans, city);
    expect(rows[0]).toEqual({ label: "Late night", kind: "late", fans: 6, city: 0 });
    expect(rows).toContainEqual({ label: "Craft beer", kind: "drink", fans: 6, city: 2 });
    expect(rows[rows.length - 1]).toEqual({ label: "Seafood", kind: "food", fans: 4, city: 8 });
  });

  it("counts a tag once per place", () => {
    const fans = Array.from({ length: 3 }, (_, i) => place(`f${i}`, [BEER, BEER]));
    expect(compareTasteCounts(fans, [])).toEqual([{ label: "Craft beer", kind: "drink", fans: 3, city: 0 }]);
  });
});

describe("toNearSpots", () => {
  it("drops parks and keeps the street part of the address", () => {
    const spots = toNearSpots(
      [
        place("a", [BAR], "100 Fixture Ave Testville, ZZ 00000"),
        place("b", [PARK], "1 Park Rd Testville"),
      ],
      "Testville",
    );
    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({ street: "100 Fixture Ave", eatDrink: true, kinds: ["Cocktail bar"] });
  });
});

const base: DraftInput = {
  headliner: "Fixture Headliner",
  opener: "Fixture Opener",
  cityLabel: "Testville",
  venueName: "Fixture Room",
  street: "100 Fixture Ave",
  neighborhoods: ["North End"],
  rows: [{ label: "Craft beer", kind: "drink", fans: 11, city: 7 }],
  fanSample: 15,
  citySample: 15,
  nearEatDrink: ["Fixture Place a", "Fixture Place b"],
  localActs: [],
  styleTags: ["indie folk"],
};

describe("draftProblems", () => {
  it("allows counts from the data and rejects invented numbers or prices", () => {
    expect(draftProblems("11 of their 15 spots list craft beer.", base)).toEqual([]);
    expect(draftProblems("Pints are $7 all night.", base)).toContain("price");
    expect(draftProblems("Over 40 breweries nearby.", base)).toContain("number 40");
    expect(draftProblems("10% off the first glass.", base)).toEqual([]);
  });

  it("rejects local claims unless the origin match is real", () => {
    expect(draftProblems("Testville's own Fixture Headliner plays.", base)).toContain("local claim");
    const withLocalOpener = { ...base, localActs: ["Fixture Opener"] };
    expect(draftProblems("Local favourite Fixture Opener warms up.", withLocalOpener)).toEqual([]);
    expect(
      draftProblems("Hometown hero Fixture Headliner plays.", withLocalOpener),
    ).toContain("local claim Fixture Headliner");
  });
});

describe("drafted copy", () => {
  it("template copy passes its own checks", () => {
    const t = templateDraft(base, 2);
    expect(t.source).toBe("template");
    for (const line of [...t.ideas.flatMap((i) => [i.title, i.body]), ...t.captions]) {
      expect(draftProblems(line, base)).toEqual([]);
    }
  });

  it("refuses model output that overclaims", () => {
    const raw = JSON.stringify({
      ideas: [
        { basis: "Craft beer", title: "Guest tap", body: "Pour a guest tap all night." },
        { basis: "nearby", title: "Team up nearby", body: "Keep the kitchen open." },
      ],
      captions: ["Testville's own Fixture Headliner, [date].", "Doors [time], come early."],
    });
    expect(parseDraft(raw, base, 2)).toBeNull();
    const ok = raw.replace("Testville's own ", "");
    expect(parseDraft(ok, base, 2)?.source).toBe("agent");
  });
});

describe("ideas only build on where fans lean more", () => {
  it("rejects an idea citing a count where the city leads", () => {
    const input: DraftInput = {
      ...base,
      rows: [
        { label: "Craft beer", kind: "drink", fans: 11, city: 7 },
        { label: "Coffee and tea", kind: "drink", fans: 3, city: 13 },
      ],
    };
    const raw = (basis: string) =>
      JSON.stringify({
        ideas: [
          { basis: "Craft beer", title: "Guest tap", body: "Pour a guest tap all night." },
          { basis, title: "Late coffee", body: "Keep a pot on for the walk home." },
        ],
        captions: ["Fixture Headliner, [date].", "Doors [time], come early."],
      });
    expect(parseDraft(raw("Coffee and tea"), input, 2)).toBeNull();
    expect(parseDraft(raw("nearby"), input, 2)?.ideas[1]?.basis).toBe("nearby");
  });
});

describe("combined rows", () => {
  const rows = [
    { label: "Late night", kind: "late" as const, fans: 10, city: 5 },
    { label: "Burgers", kind: "food" as const, fans: 6, city: 1 },
  ];
  it("flags two separate rows merged into one claim", () => {
    const input = { ...base, rows };
    expect(draftProblems("Stay for late-night burgers.", input)).toContain("combined rows Late night + Burgers");
    expect(draftProblems("Late night small plates and a burger special.", input)).toEqual([]);
  });
});

describe("captions", () => {
  it("rejects two captions that say the same thing", () => {
    expect(nearDuplicate("Fixture Headliner plays Fixture Ave on [date].", "Fixture Headliner plays Fixture Ave, [date] at [time].")).toBe(true);
    expect(nearDuplicate("Fixture Headliner on [date], doors [time].", "Craft beer and late plates after the set.")).toBe(false);
  });
});

describe("typedVenueLabel", () => {
  it("keeps the capacity the owner typed", () => {
    expect(typedVenueLabel("Fixture cafe-bar, 300 capacity")).toBe("Fixture cafe-bar, 300 capacity");
    expect(typedVenueLabel("  ")).toBe("Your venue");
  });
});
