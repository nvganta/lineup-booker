import { describe, expect, it } from "vitest";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/map-tiles";

describe("map tiles", () => {
  it("uses a keyless OSM tile template without CARTO api-key hosts", () => {
    expect(MAP_TILE_URL).toContain("openstreetmap.de");
    expect(MAP_TILE_URL).not.toContain("basemaps.cartocdn.com");
    const sample = MAP_TILE_URL.replace("{z}", "12")
      .replace("{x}", "646")
      .replace("{y}", "1401");
    expect(sample).toMatch(/^https:\/\/tile\.openstreetmap\.de\/12\/646\/1401\.png$/);
    expect(MAP_TILE_ATTRIBUTION).toContain("OpenStreetMap");
  });
});
