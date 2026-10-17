import { describe, expect, it, vi } from "vitest";
import type { QlooEntity } from "@/lib/qloo/types";
import { selectBenchEntities } from "@/lib/lineup/bench-select";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";

vi.mock("@/lib/agent/research/actor-screen", () => ({
  filterActorFirstEntities: vi.fn(async (entities: QlooEntity[]) => entities),
  isActorFirstByWikipedia: vi.fn(async () => false),
}));

vi.mock("@/lib/agent/research/musician-screen", () => ({
  filterVerifiedMusicianBench: vi.fn(async () => []),
}));

const indieTags = ["urn:tag:genre:music:indie_rock"];

describe("selectBenchEntities", () => {
  it("falls back to ranked pool when musician screen clears the top chunk (Silver Lake-style)", async () => {
    const band = popularityBandFromConcept("220 capacity room");
    const headliner: QlooEntity = {
      name: "Fixture Local Headliner",
      entity_id: "head-local",
      popularity: 0.82,
      subtype: "urn:entity:artist",
      tags: [
        { id: "urn:tag:genre:music:indie_rock" },
        { id: "urn:tag:obscurity:qloo:4" },
      ],
    };
    const mainstream: QlooEntity = {
      name: "Fixture Mainstream Bench Act",
      entity_id: "bench-main",
      popularity: 0.78,
      subtype: "urn:entity:artist",
      tags: [
        { id: "urn:tag:genre:music:indie_rock" },
        { id: "urn:tag:obscurity:qloo:2" },
      ],
    };
    const indieBench: QlooEntity = {
      name: "Fixture Indie Bench Act",
      entity_id: "bench-indie",
      popularity: 0.74,
      subtype: "urn:entity:artist",
      tags: [
        { id: "urn:tag:genre:music:indie_rock" },
        { id: "urn:tag:obscurity:qloo:5" },
      ],
    };

    const bench = await selectBenchEntities(
      [headliner, mainstream, indieBench],
      indieTags,
      band,
      headliner,
      [headliner],
      () => undefined,
    );

    expect(bench.length).toBeGreaterThan(0);
    expect(bench.some((e) => e.entity_id === "bench-main")).toBe(true);
  });
});
