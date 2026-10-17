import { describe, expect, it, vi } from "vitest";
import type { QlooEntity } from "@/lib/qloo/types";
import { pickOpener } from "@/lib/lineup/opener-select";
import type { PopularityBand } from "@/lib/lineup/tiers";

const tag = { id: "urn:tag:genre:music:indie", type: "urn:tag:genre:music" };
const genreTags = ["urn:tag:genre:music:indie"];

vi.mock("@/lib/lineup/artist-origin-sources", () => ({
  gatherArtistOriginTexts: vi.fn(async (name: string) => {
    if (name.includes("Fixture Opener With Origin")) {
      return ["Fixtureville, Ontario, Canada"];
    }
    if (name.includes("Fixture Opener Toronto Star")) {
      return ["Toronto, Ontario, Canada"];
    }
    if (name.includes("Fixture Opener Prairie Signal")) {
      return ["Fixture Prairie, Alberta, Canada"];
    }
    return [];
  }),
}));

vi.mock("@/lib/agent/research/actor-screen", () => ({
  isActorFirstByWikipedia: vi.fn(async () => false),
}));

vi.mock("@/lib/qloo/client", () => ({
  qlooGet: vi.fn(async (_path: string, params: Record<string, string>) => {
    const resultsId = params["filter.results.entities"];
    const localIds = new Set([
      "opener-brooklyn-a",
      "opener-london-a",
      "room-fit-local",
    ]);
    return {
      data: {
        results: {
          entities:
            resultsId && localIds.has(resultsId)
              ? [{ entity_id: resultsId, name: "local" }]
              : [],
        },
      },
      request: { method: "GET", path: "/v2/insights", query: "" },
    };
  }),
}));

function headliner(pop = 0.7): QlooEntity {
  return {
    name: "Fixture Headliner",
    entity_id: "head",
    popularity: pop,
    type: "artist",
    subtype: "urn:entity:artist",
    tags: [tag],
  };
}

describe("opener pick without origin data", () => {
  it("uses Qloo local-in-city signal when research has no origin text", async () => {
    const candidates: QlooEntity[] = [
      {
        name: "Fixture Opener Brooklyn A",
        entity_id: "opener-brooklyn-a",
        popularity: 0.52,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [tag],
      },
    ];
    const { opener } = await pickOpener(
      candidates,
      headliner(),
      "head",
      {
        lat: 40.716,
        lon: -73.963,
        city: "New York",
        borough: "Brooklyn",
      },
      genreTags,
      { requests: [], localQueryCity: "New York" },
    );
    expect(opener?.entity_id).toBe("opener-brooklyn-a");
  });

  it("uses Qloo local signal when no origin text is available", async () => {
    const candidates: QlooEntity[] = [
      {
        name: "Fixture Opener London A",
        entity_id: "opener-london-a",
        popularity: 0.5,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [tag],
      },
    ];
    const { opener } = await pickOpener(
      candidates,
      headliner(),
      "head",
      { lat: 51.523, lon: -0.075, city: "London", borough: "Hackney" },
      genreTags,
      { requests: [], localQueryCity: "London" },
    );
    expect(opener?.entity_id).toBe("opener-london-a");
  });
});

describe("opener room popularity cap (≤300 seats)", () => {
  const smallRoomBand: PopularityBand = {
    headlinerMin: 0.55,
    headlinerMax: 0.88,
    openerMax: 0.72,
    seatCapacity: 60,
  };

  it("skips a famous local opener and picks a room-sized act (Toronto 60-cap)", async () => {
    const candidates: QlooEntity[] = [
      {
        name: "Fixture Opener Toronto Star",
        entity_id: "star-local",
        popularity: 0.85,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [tag],
      },
      {
        name: "Fixture Opener Room Fit",
        entity_id: "room-fit-local",
        popularity: 0.58,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [tag],
      },
    ];
    const { opener, audit } = await pickOpener(
      candidates,
      headliner(0.88),
      "head",
      { lat: 43.65, lon: -79.38, city: "Toronto" },
      genreTags,
      {
        requests: [],
        band: smallRoomBand,
        localQueryCity: "Toronto",
      },
    );
    expect(opener?.entity_id).toBe("room-fit-local");
    expect(
      audit.some((a) => a.reason === "above room opener popularity cap"),
    ).toBe(true);
  });

  it("rejects when research origin is out of market even if Qloo shows local taste", async () => {
    const candidates: QlooEntity[] = [
      {
        name: "Fixture Opener Prairie Signal",
        entity_id: "prairie-op",
        popularity: 0.55,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [tag],
      },
    ];
    const { opener, audit } = await pickOpener(
      candidates,
      headliner(),
      "head",
      { lat: 43.65, lon: -79.38, city: "Toronto" },
      genreTags,
      { requests: [], localQueryCity: "Toronto" },
    );
    expect(opener).toBeNull();
    expect(audit[0]?.reason).toBe("origin outside venue city or borough");
  });

  it("still rejects wrong origin when origin text is present", async () => {
    const candidates: QlooEntity[] = [
      {
        name: "Fixture Opener With Origin",
        entity_id: "wrong-origin",
        popularity: 0.55,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [tag],
      },
    ];
    const { opener, audit } = await pickOpener(
      candidates,
      headliner(),
      "head",
      { lat: 43.65, lon: -79.38, city: "Toronto" },
      genreTags,
      { requests: [], localQueryCity: "Toronto" },
    );
    expect(opener).toBeNull();
    expect(audit[0]?.reason).toBe("origin outside venue city or borough");
  });
});
