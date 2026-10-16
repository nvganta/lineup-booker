import type { QlooInsightsResponse, QlooTagsResponse } from "./types";

const FIXTURE_ARTIST_A = {
  entity_id: "urn:entity:artist:fixture-alpha",
  name: "Fixture Artist Alpha",
  popularity: 0.74,
  properties: { image: { url: "https://example.test/fixture-alpha.jpg" } },
  tags: [{ id: "urn:tag:genre:music:indie_folk" }],
};

const FIXTURE_ARTIST_B = {
  entity_id: "urn:entity:artist:fixture-beta",
  name: "Fixture Opener Beta",
  popularity: 0.62,
  properties: { image: { url: "https://example.test/fixture-beta.jpg" } },
  tags: [{ id: "urn:tag:genre:music:indie_folk" }],
};

export function mockQlooJsonForUrl(url: string): unknown | null {
  if (!process.env.QLOO_MOCK_TRANSPORT) return null;
  if (url.includes("/v2/tags")) {
    const body: QlooTagsResponse = {
      results: {
        tags: [
          {
            tag_id: "urn:tag:genre:music:indie_folk",
            name: "Indie Folk",
          },
        ],
      },
    };
    return body;
  }
  if (url.includes("/v2/insights")) {
    if (url.includes("urn:demographics")) {
      const body: QlooInsightsResponse = {
        results: {
          entities: [
            {
              name: "25-34",
              query: { affinity: 0.81 },
            },
          ],
        },
      };
      return body;
    }
    if (url.includes("filter.type=urn%3Atag")) {
      const body: QlooInsightsResponse = {
        results: {
          tags: [
            { tag_id: "urn:tag:genre:music:adjacent_a", name: "Adjacent A" },
          ],
        },
      };
      return body;
    }
    const body: QlooInsightsResponse = {
      results: {
        entities: [FIXTURE_ARTIST_A, FIXTURE_ARTIST_B],
        heatmap: [
          {
            location: { latitude: 49.26, longitude: -123.1 },
            query: { affinity: 0.88 },
          },
          {
            location: { latitude: 49.28, longitude: -123.12 },
            query: { affinity: 0.82 },
          },
        ],
      },
    };
    return body;
  }
  if (url.includes("/search")) {
    return { results: [FIXTURE_ARTIST_A] };
  }
  return { results: {} };
}
