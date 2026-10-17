import { describe, expect, it, vi, afterEach } from "vitest";
import { pickHeadlinerForVenue } from "@/lib/lineup/headliner-local-pick";
import {
  resetResearchFetch,
  setResearchFetch,
} from "@/lib/agent/research/fetch";
import type { QlooEntity } from "@/lib/qloo/types";

describe("headliner local origin preference", () => {
  afterEach(() => {
    resetResearchFetch();
  });

  it("prefers a locally rooted act in small rooms when wiki origin matches", async () => {
    setResearchFetch(
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("Fixture_Local_Act") || url.includes("Fixture%20Local%20Act")) {
          return new Response(
            JSON.stringify({
              extract: "Fixture Local Act is a band from Brooklyn, New York.",
            }),
            { status: 200 },
          );
        }
        return new Response("", { status: 404 });
      }),
    );

    const tag = { id: "urn:tag:genre:music:indie", type: "urn:tag:genre:music" };
    const entities: QlooEntity[] = [
      {
        name: "Fixture Touring Act",
        entity_id: "tour",
        popularity: 0.7,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [tag],
      },
      {
        name: "Fixture Local Act",
        entity_id: "local",
        popularity: 0.68,
        type: "artist",
        subtype: "urn:entity:artist",
        tags: [tag],
      },
    ];

    const picked = await pickHeadlinerForVenue(
      entities,
      ["urn:tag:genre:music:indie"],
      {
        seatCapacity: 120,
        headlinerMin: 0.5,
        headlinerMax: 0.75,
        openerMax: 0.7,
      },
      {
        lat: 40.716,
        lon: -73.963,
        city: "New York",
        borough: "Brooklyn",
        county: "Kings County",
      },
    );
    expect(picked?.name).toBe("Fixture Local Act");
  });
});
