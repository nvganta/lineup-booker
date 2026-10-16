import type { LineupRequest } from "@/lib/lineup/schemas";

export type ExampleVenue = {
  label: string;
  request: LineupRequest;
};

export const EXAMPLE_VENUES: ExampleVenue[] = [
  {
    label: "Natural wine bar · Vancouver",
    request: {
      concept: "Natural wine and small plates cafe-bar, 300 capacity",
      location: "2509 Main St, Vancouver, BC",
      regularsLove: "Indie folk and vinyl nights",
    },
  },
  {
    label: "Taco spot · Silver Lake",
    request: {
      concept: "Neighborhood taco bar, 150 capacity",
      location: "2801 Sunset Blvd, Silver Lake, Los Angeles, CA",
      regularsLove: "Indie rock and dream pop",
    },
  },
  {
    label: "Cocktail bar · Shoreditch",
    request: {
      concept: "Cocktail bar with live sets, 250 capacity",
      location: "134 Shoreditch High St, London",
      regularsLove: "Soul, jazz, and electronic",
    },
  },
];
