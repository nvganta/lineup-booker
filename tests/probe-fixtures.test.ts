import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { QlooEntity } from "@/lib/qloo/types";
import {
  artistNameKey,
  isSamePerson,
  isMusicArtist,
} from "@/lib/lineup/artist-filter";
import {
  filterNeighborhoodLocalities,
  isBroadRegion,
  isVenueCityName,
  trimHeatmapLocalities,
  type LocalityRow,
  type VenuePin,
} from "@/lib/lineup/geography";
import { openerPopularityMax } from "@/lib/lineup/opener-select";

type ProbeNeighborhoodRaw = {
  name: string;
  affinity?: number;
  disambiguation?: string;
  hasBoundary?: boolean;
};

type ProbeFixture = {
  venue: {
    city: string;
    pin?: VenuePin;
    tags: string[];
    musicTagIds?: string[];
  };
  headliner: { name: string; id: string; popularity: number };
  neighborhoods: {
    raw: ProbeNeighborhoodRaw[];
    audit?: Array<{ name: string; kept: boolean; reason: string }>;
  };
  openers?: {
    raw: Array<{ name: string; id: string; popularity?: number }>;
    audit?: Array<{ name: string; reason: string }>;
  };
  openerMax?: number;
};

const PROBES_DIR = path.join(__dirname, "fixtures/probes");

function loadProbe(fileName: string): ProbeFixture {
  const raw = fs.readFileSync(path.join(PROBES_DIR, fileName), "utf8");
  return JSON.parse(raw) as ProbeFixture;
}

function toLocalityRows(raw: ProbeNeighborhoodRaw[]): LocalityRow[] {
  return raw.map((row) => ({
    name: row.name,
    disambiguation: row.disambiguation,
    query: { affinity: row.affinity },
  }));
}

/** Same-latitude offset so haversine distance from pin ≈ distanceKm. */
function lonForDistanceKm(pin: VenuePin, distanceKm: number): number {
  const latRad = (pin.lat * Math.PI) / 180;
  const dLonRad = distanceKm / (6371 * Math.cos(latRad));
  return pin.lon + (dLonRad * 180) / Math.PI;
}

function squareBoundaryWkt(lon: number, lat: number, halfDeg = 0.001): string {
  const a = halfDeg;
  return `POLYGON((${lon - a} ${lat - a},${lon + a} ${lat - a},${lon + a} ${lat + a},${lon - a} ${lat + a},${lon - a} ${lat - a}))`;
}

type NeighborhoodAuditRow = {
  name: string;
  kept: boolean;
  reason: string;
  distanceKm?: number | null;
};

function localitiesWithProbeGeometry(
  raw: ProbeNeighborhoodRaw[],
  audit: NeighborhoodAuditRow[],
  pin: VenuePin,
): LocalityRow[] {
  const auditByName = new Map(audit.map((a) => [a.name, a]));
  return trimHeatmapLocalities(
    raw.map((row) => {
      const entry = auditByName.get(row.name);
      const entity: LocalityRow = {
        name: row.name,
        disambiguation: row.disambiguation,
        query: { affinity: row.affinity },
      };
      if (entry?.distanceKm != null && entry.distanceKm >= 0) {
        const lon = lonForDistanceKm(pin, entry.distanceKm);
        entity.properties = { boundary: squareBoundaryWkt(lon, pin.lat) };
      }
      return entity;
    }),
  );
}

describe("live probe fixtures (8b8c360 regressions)", () => {
  const vancouver = loadProbe("fixture-vancouver-a.json");
  const silverlake = loadProbe("fixture-silverlake-a.json");

  it("Vancouver: drops country/province/metro admin names from heatmap rows", () => {
    const blocked = [
      "Canada",
      "British Columbia",
      "Metro Vancouver",
      "Electoral Area A",
    ];
    for (const name of blocked) {
      const row = vancouver.neighborhoods.raw.find((r) => r.name === name);
      expect(row, name).toBeDefined();
      expect(isBroadRegion(name, row!.disambiguation)).toBe(true);
    }
  });

  it("Silver Lake: drops US macro regions from heatmap rows", () => {
    const blocked = [
      "Contiguous United States",
      "Southern California",
      "California",
    ];
    for (const name of blocked) {
      const row = silverlake.neighborhoods.raw.find((r) => r.name === name);
      expect(row, name).toBeDefined();
      expect(isBroadRegion(name, row!.disambiguation)).toBe(true);
    }
  });

  it("Vancouver: opener popularity cap follows headliner minus gap", () => {
    const max = openerPopularityMax(vancouver.headliner.popularity);
    expect(max).toBeCloseTo(vancouver.headliner.popularity - 0.03, 5);
    expect(max).toBeLessThan(0.9);
  });

  it("Vancouver: long-name opener collides with short headliner name", () => {
    const headliner: QlooEntity = {
      name: "Zed",
      entity_id: vancouver.headliner.id,
      popularity: vancouver.headliner.popularity,
      subtype: "urn:entity:artist",
      type: "artist",
    };
    const opener: QlooEntity = {
      name: "Artist Zed",
      entity_id: vancouver.openers!.raw[0]!.id,
      popularity: vancouver.openers!.raw[0]!.popularity,
      subtype: "urn:entity:artist",
      type: "artist",
    };
    expect(isSamePerson(headliner, opener)).toBe(true);
    expect(artistNameKey("Artist Zed")).not.toBe(artistNameKey("Zed"));
  });

  it("trimHeatmapLocalities dedupes duplicate neighbourhood names", () => {
    const rows = toLocalityRows(vancouver.neighborhoods.raw);
    const trimmed = trimHeatmapLocalities(rows);
    const names = trimmed.map((r) => r.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(trimmed.length).toBeLessThanOrEqual(15);
  });

  it("Vancouver: city-named locality is not treated as a promotable neighbourhood", () => {
    const pin = vancouver.venue.pin!;
    const row = vancouver.neighborhoods.raw.find((r) => r.name === "Vancouver")!;
    expect(isVenueCityName(row.name, pin)).toBe(true);
  });
});

describe("filterNeighborhoodLocalities with probe-derived geometry", () => {
  it("Vancouver Main St: keeps in-city rows within 5 km and drops admin regions", async () => {
    const probe = loadProbe("fixture-vancouver-a.json");
    const pin = probe.venue.pin!;
    const audit = (probe.neighborhoods.audit ?? []) as NeighborhoodAuditRow[];

    const { kept, audit: filterAudit } = await filterNeighborhoodLocalities(
      localitiesWithProbeGeometry(probe.neighborhoods.raw, audit, pin),
      pin,
    );

    const keptNames = kept.map((k) => k.name);
    expect(keptNames).toContain("Mount Pleasant");
    expect(keptNames).not.toContain("Canada");
    expect(filterAudit.find((a) => a.name === "Canada")?.kept).toBe(false);
    expect(keptNames.length).toBeLessThanOrEqual(5);
  });
});

describe("pickOpener (no explainability overlap reject)", () => {
  it("selects first local opener under headliner popularity", async () => {
    vi.mock("@/lib/qloo/client", () => ({
      qlooGet: vi.fn(async (_path: string, params: Record<string, string>) => {
        const resultsId = params["filter.results.entities"];
        return {
          data: {
            results: {
              entities: resultsId
                ? [{ entity_id: resultsId, name: "local" }]
                : [],
            },
          },
          request: { method: "GET", path: "/v2/insights", query: "" },
        };
      }),
    }));

    const { pickOpener: pick } = await import("@/lib/lineup/opener-select");

    const headliner: QlooEntity = {
      name: "Fixture Headliner Zed",
      entity_id: "head",
      popularity: 0.71,
      subtype: "urn:entity:artist",
      type: "artist",
    };

    const candidates: QlooEntity[] = [
      {
        name: "Fixture Opener Folk",
        entity_id: "lb",
        popularity: 0.66,
        subtype: "urn:entity:artist",
        type: "artist",
        tags: [{ id: "urn:tag:genre:music:folk" }],
      },
    ];

    const { opener, audit } = await pick(
      candidates,
      headliner,
      "head",
      "Vancouver",
      ["urn:tag:genre:music:folk"],
      [],
    );

    expect(opener?.name).toBe("Fixture Opener Folk");
    expect(audit.some((a) => a.reason.includes("fan overlap"))).toBe(false);
    expect(audit.find((a) => a.kept)?.reason).toBe("selected");
  });
});

describe("isMusicArtist with genre tags", () => {
  it("requires music genre tags on artist entities", () => {
    const untagged: QlooEntity = {
      name: "Fixture Untagged Artist",
      subtype: "urn:entity:artist",
      type: "artist",
    };
    expect(isMusicArtist(untagged, ["urn:tag:genre:music:folk"])).toBe(false);
  });
});
