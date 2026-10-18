"use client";

import type { LineupResult } from "@/lib/lineup/build-lineup";
import {
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_CLASS,
  MAP_TILE_URL,
} from "@/lib/map-tiles";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const TERRACOTTA = "#8c4a32";
const VENUE_PIN_MIN_KM = 0.2;
const VENUE_PIN_NUDGE_DEG = 0.0028;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function venueMarkerLatLng(
  venue: NonNullable<LineupResult["venue"]>,
  neighborhoods: LineupResult["neighborhoods"],
): [number, number] {
  const pin1 = neighborhoods.find(
    (n) => n.rank === 1 && n.lat != null && n.lon != null,
  );
  if (!pin1) return [venue.lat, venue.lon];

  const dist = haversineKm(venue.lat, venue.lon, pin1.lat!, pin1.lon!);
  if (dist >= VENUE_PIN_MIN_KM) return [venue.lat, venue.lon];

  const dLat = venue.lat - pin1.lat!;
  const dLon = venue.lon - pin1.lon!;
  const mag = Math.hypot(dLat, dLon) || 1;
  return [
    venue.lat - (dLat / mag) * VENUE_PIN_NUDGE_DEG,
    venue.lon - (dLon / mag) * VENUE_PIN_NUDGE_DEG,
  ];
}

function neighborhoodPinLatLng(
  anchorLat: number,
  anchorLon: number,
  n: { rank: number; lat: number; lon: number },
): [number, number] {
  const dist = haversineKm(anchorLat, anchorLon, n.lat, n.lon);
  if (dist >= VENUE_PIN_MIN_KM) return [n.lat, n.lon];
  const angle = -Math.PI / 2 + n.rank * 0.85;
  const push = VENUE_PIN_NUDGE_DEG * (1.4 + n.rank * 0.45);
  return [
    n.lat + Math.cos(angle) * push,
    n.lon + Math.sin(angle) * push,
  ];
}

function pinIcon(rank: number) {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:26px;height:26px;border-radius:9999px;
      background:${TERRACOTTA};color:#faf7f2;
      font:600 12px/1 system-ui,sans-serif;
      border:2px solid #faf7f2;
      box-shadow:0 1px 3px rgba(26,22,20,0.2);
    ">${rank}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const TILE_PANE_FILTER =
  "grayscale(1) sepia(0.15) contrast(0.9) brightness(1.05)";

function MutedTilePane() {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane("tilePane");
    if (pane) pane.style.filter = TILE_PANE_FILTER;
  }, [map]);
  return null;
}

function FitBounds({
  venue,
  neighborhoods,
}: {
  venue: NonNullable<LineupResult["venue"]>;
  neighborhoods: LineupResult["neighborhoods"];
}) {
  const map = useMap();
  useEffect(() => {
    const pinPoints: L.LatLngExpression[] = neighborhoods
      .filter((n) => n.lat != null && n.lon != null)
      .map((n) => [n.lat!, n.lon!] as L.LatLngExpression);
    if (pinPoints.length >= 2) {
      // The card map is a short strip, so keep vertical padding just
      // larger than half a pin and let zoom snap in quarter steps.
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(pinPoints), {
        paddingTopLeft: [24, 16],
        paddingBottomRight: [24, 16],
        maxZoom: 15,
      });
      return;
    }
    const [vLat, vLon] = venueMarkerLatLng(venue, neighborhoods);
    map.setView([vLat, vLon], 14);
  }, [map, venue, neighborhoods]);
  return null;
}

type Props = {
  lineup: Pick<LineupResult, "venue" | "neighborhoods">;
  className?: string;
};

export function LineupMap({ lineup, className }: Props) {
  const venue = lineup.venue;
  if (!venue) return null;

  const mappable = lineup.neighborhoods.filter(
    (n) => n.lat != null && n.lon != null,
  );
  const [venueLat, venueLon] = venueMarkerLatLng(venue, lineup.neighborhoods);

  return (
    <div
      className={`${className ?? ""} ${MAP_TILE_CLASS} [&_.leaflet-control-zoom]:hidden [&_.leaflet-bar]:hidden`}
    >
      <MapContainer
        center={[venue.lat, venue.lon]}
        zoom={13}
        zoomSnap={0.25}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        className="h-full w-full rounded-md border border-[#e8dfd6] bg-[#f3ece4] [&_.leaflet-control-attribution]:text-[9px] [&_.leaflet-control-attribution]:text-[#8a7f76]"
        style={{ minHeight: 72 }}
      >
        <TileLayer
          attribution={MAP_TILE_ATTRIBUTION}
          url={MAP_TILE_URL}
          detectRetina={false}
          subdomains="abc"
        />
        <MutedTilePane />
        <FitBounds venue={venue} neighborhoods={lineup.neighborhoods} />
        <Marker
          position={[venueLat, venueLon]}
          zIndexOffset={600}
          icon={L.divIcon({
            className: "",
            html: `<span style="
              width:11px;height:11px;border-radius:2px;
              background:#1a1614;border:2px solid #faf7f2;
              display:block;box-shadow:0 1px 3px rgba(26,22,20,0.25);
            "></span>`,
            iconSize: [11, 11],
            iconAnchor: [5, 5],
          })}
        />
        {mappable.map((n) => {
          const [pLat, pLon] = neighborhoodPinLatLng(venueLat, venueLon, {
            rank: n.rank,
            lat: n.lat!,
            lon: n.lon!,
          });
          return (
            <Marker
              key={n.rank}
              position={[pLat, pLon]}
              zIndexOffset={400 - n.rank}
              icon={pinIcon(n.rank)}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
