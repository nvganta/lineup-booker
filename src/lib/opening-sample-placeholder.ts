import type { LineupResult } from "@/lib/lineup/build-lineup";

/** Fictional fallback when the Vancouver pipeline call is unavailable. */
export function openingSamplePlaceholder(): LineupResult {
  return {
    venueLabel: "Natural wine and small plates cafe-bar",
    eventLabel: "Live music night",
    venue: { lat: 49.2627, lon: -123.1013, city: "Vancouver" },
    headliner: {
      id: "placeholder-headliner",
      name: "Sample headliner",
      tierLabel: "Headliner",
    },
    opener: {
      id: "placeholder-opener",
      name: "Sample opener",
      tierLabel: "Opener",
    },
    alternates: [
      { id: "placeholder-alt-1", name: "Sample alternate A", tierLabel: "#2" },
      { id: "placeholder-alt-2", name: "Sample alternate B", tierLabel: "#3" },
    ],
    neighborhoods: [
      { name: "Neighbourhood one", rank: 1, lat: 49.27, lon: -123.11 },
      { name: "Neighbourhood two", rank: 2, lat: 49.28, lon: -123.12 },
    ],
    provenance: { requests: [] },
  };
}
