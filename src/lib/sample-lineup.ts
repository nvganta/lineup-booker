import type { LineupResult } from "@/lib/lineup/build-lineup";

export const SAMPLE_LINEUP: LineupResult = {
  venueLabel: "Natural wine and small plates cafe-bar",
  eventLabel: "Live music night",
  headliner: {
    id: "sample-headliner",
    name: "Fixture Headliner Alpha",
    tierLabel: "Top local match",
  },
  opener: {
    id: "sample-opener",
    name: "Fixture Opener Beta",
    tierLabel: "Best support fit",
  },
  alternates: [
    {
      id: "a2",
      name: "Fixture Alternate Gamma",
      tierLabel: "#2 in your crowd profile",
    },
    {
      id: "a3",
      name: "Fixture Alternate Delta",
      tierLabel: "#3 in your crowd profile",
    },
  ],
  neighborhoods: [
    { name: "Mount Pleasant", rank: 1 },
    { name: "Strathcona", rank: 2 },
    { name: "Grandview-Woodland", rank: 3 },
  ],
  provenance: { requests: [] },
};
