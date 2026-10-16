import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetResearchFetch,
  setResearchFetch,
  type ResearchFetch,
} from "@/lib/agent/research/fetch";
import { isClearlyMusician } from "@/lib/agent/research/match";
import { researchOneArtist } from "@/lib/agent/research/research-artists";
import { RESEARCH_TOTAL_MS } from "@/lib/agent/research/types";
import { flushArtistResearch, scheduleArtistResearch } from "@/lib/agent/research/scheduler";
import { createEmptySession } from "@/lib/agent/runtime";
import {
  extendAllowedFromResearchBackgrounds,
  findUnknownProperNames,
  validatePitchPayload,
} from "@/lib/agent/pitch-validator";
import { resetMusicBrainzRateLimit } from "@/lib/agent/research/musicbrainz";

afterEach(() => {
  resetResearchFetch();
  resetMusicBrainzRateLimit();
  vi.useRealTimers();
});

describe("artist research match rejection", () => {
  it("rejects non-musician Wikipedia summaries", () => {
    expect(
      isClearlyMusician(
        "Springfield is a city in Illinois.",
        "Springfield",
        "Fixture Alpha",
      ),
    ).toBe(false);
    expect(
      isClearlyMusician(
        "Fixture Alpha is a Canadian indie rock singer and songwriter.",
        "Fixture Alpha",
        "Fixture Alpha",
      ),
    ).toBe(true);
  });

  it("returns null when Wikipedia only has a city collision", async () => {
    const fetchMock: ResearchFetch = async (input) => {
      const url = String(input);
      if (url.includes("w/api.php")) {
        return Response.json({
          query: { search: [{ title: "Fixture City" }] },
        });
      }
      if (url.includes("Fixture_City")) {
        return Response.json({
          title: "Fixture City",
          description: "A city in the test province.",
          extract: "Fixture City is a city in the test province.",
        });
      }
      if (url.includes("musicbrainz.org")) {
        return Response.json({ artists: [] });
      }
      return new Response("", { status: 404 });
    };
    setResearchFetch(fetchMock);
    const bg = await researchOneArtist({ name: "Fixture Alpha" });
    expect(bg).toBeNull();
  });
});

describe("artist research timeout cap", () => {
  it("stops waiting after the total budget", async () => {
    vi.useFakeTimers();
    setResearchFetch(() => new Promise(() => {}));

    const session = createEmptySession();
    scheduleArtistResearch(session, { id: "a1", name: "Fixture Alpha" });
    const flushPromise = flushArtistResearch(session, RESEARCH_TOTAL_MS);
    await vi.advanceTimersByTimeAsync(RESEARCH_TOTAL_MS + 50);
    const backgrounds = await flushPromise;
    expect(Object.keys(backgrounds)).toHaveLength(0);
  });
});

describe("pitch validator research facts", () => {
  it("allows place and release tokens from research backgrounds", () => {
    const backgrounds = [
      {
        origin: "Victoria, BC",
        activeSince: "2005",
        notableReleases: ["Fixture Album One"],
        knownFor: "Fixture Album One is their best-known LP.",
      },
    ];
    const allowed = new Set<string>(["fixture alpha", "fixture beta"]);
    extendAllowedFromResearchBackgrounds(allowed, backgrounds);
    const unknown = findUnknownProperNames(
      "Fixture Alpha is Victoria-born and known for Fixture Album One since 2005.",
      allowed,
      "2509 Main St, Vancouver, BC",
    );
    expect(unknown).toEqual([]);

    const result = validatePitchPayload({
      venueLabel: "Fixture wine bar",
      address: "2509 Main St, Vancouver, BC",
      moodLine: "Fixture Alpha fits the room.",
      headlinerWhy:
        "Fixture Alpha matches tags; Victoria-born since 2005 with Fixture Album One in the catalog.",
      openerWhy: "Fixture Beta opens.",
      crowdLine: "Mixed crowd.",
      headliner: {
        id: "h1",
        name: "Fixture Alpha",
        background: {
          line: "Victoria-born, active since 2005 · known for Fixture Album One",
          sourceName: "Wikipedia",
          sourceUrl: "https://en.wikipedia.org/wiki/Fixture_Alpha",
        },
      },
      opener: { id: "o1", name: "Fixture Beta" },
      alternates: [],
      neighborhoods: [{ rank: 1, name: "Mount Pleasant" }],
      evidenceFootnotes: {},
    });
    expect(result.ok).toBe(true);
  });
});

describe("research identity and wording", () => {
  it("matches names exactly, not by substring or first/last name", async () => {
    const { namesMatch } = await import("@/lib/agent/research/match");
    expect(namesMatch("Fixture Singer (musician)", "Fixture Singer")).toBe(true);
    expect(namesMatch("The Fixture Band", "Fixture Band")).toBe(true);
    expect(namesMatch("Fixa Ford", "Fixa")).toBe(false);
    expect(namesMatch("Fixa Middle Ford", "Fixa Ford")).toBe(false);
  });

  it("never calls a person's birth year a debut and doesn't double the period", async () => {
    const { formatBackgroundLine } = await import(
      "@/lib/agent/research/research-artists"
    );
    expect(
      formatBackgroundLine({
        origin: "Fixtureton",
        activeSince: "1982",
        kind: "person",
        notableReleases: ["The Record."],
        sourceUrl: "https://musicbrainz.org/artist/x",
        sourceName: "MusicBrainz",
      }),
    ).toBe("From Fixtureton, albums include The Record.");
  });
});
