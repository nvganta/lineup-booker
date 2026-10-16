/**
 * Keyless light basemap. CARTO Positron ({s}.basemaps.cartocdn.com/light_all/…)
 * now returns “API KEY REQUIRED” placeholder tiles without an API key, so we use
 * OpenStreetMap Deutschland’s public tile cache (verified PNG in browser + curl).
 */
export const MAP_TILE_URL =
  "https://tile.openstreetmap.de/{z}/{x}/{y}.png";

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Muted to sit on cream paper (applied to .leaflet-tile-pane img in globals.css). */
export const MAP_TILE_CLASS = "lineup-map-tiles";
