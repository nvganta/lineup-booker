import {
  isPromotableReverseGeocode,
  looksLikeStreetName,
  neighborhoodLabelFromReverse,
  reverseGeocodeNeighborhood,
  type NominatimAddress,
} from "@/lib/geocode/nominatim";
import {
  displayNeighborhoodName,
  isNonPromotableNeighborhoodLabel,
  type VenuePin,
} from "./geography";
import type { NeighborhoodCandidate } from "./heatmap-neighborhoods";
import type { PromoteNeighborhood } from "./neighborhoods";

export function homeNeighborhoodFromPin(pin: VenuePin): string | undefined {
  if (pin.homeNeighborhood?.trim()) {
    return pin.homeNeighborhood.trim();
  }
  const suburb = pin.suburb?.trim();
  if (suburb && !isNonPromotableNeighborhoodLabel(suburb, pin)) {
    return suburb;
  }
  return undefined;
}

/**
 * Finest promotable area in a Nominatim address. Suburb often holds the
 * borough ("Brooklyn") while the real neighbourhood sits in quarter
 * ("Williamsburg"), so try the fine-grained fields first.
 */
export function homeLabelFromAddress(
  address: NominatimAddress | undefined,
  pin: VenuePin,
): string | undefined {
  if (!address) return undefined;
  for (const raw of [
    address.neighbourhood,
    address.neighborhood,
    address.quarter,
    address.suburb,
    address.city_district,
  ]) {
    const label = raw?.trim();
    if (!label || looksLikeStreetName(label)) continue;
    if (isNonPromotableNeighborhoodLabel(label, pin)) continue;
    return label;
  }
  return undefined;
}

export async function resolveHomeNeighborhoodLabel(
  pin: VenuePin,
  /** Address from the venue's own geocode; saves a reverse lookup. */
  address?: NominatimAddress,
): Promise<string | undefined> {
  if (pin.homeNeighborhood?.trim()) return pin.homeNeighborhood.trim();
  const fromAddress = homeLabelFromAddress(address, pin);
  if (fromAddress) return fromAddress;
  const existing = homeNeighborhoodFromPin(pin);
  if (existing) return existing;

  const { value: reverse } = await reverseGeocodeNeighborhood(
    pin.lat,
    pin.lon,
  );
  if (!reverse) return undefined;
  const fromReverse = homeLabelFromAddress(reverse.address, pin);
  if (fromReverse) return fromReverse;
  if (!isPromotableReverseGeocode(reverse)) return undefined;
  const label = neighborhoodLabelFromReverse(reverse);
  if (!label || isNonPromotableNeighborhoodLabel(label, pin)) {
    return undefined;
  }
  return label;
}

export function prependHomeNeighborhoodCandidate(
  merged: NeighborhoodCandidate[],
  pin: VenuePin,
  homeLabel: string,
): NeighborhoodCandidate[] {
  const key = homeLabel.trim().toLowerCase();
  const rest = merged.filter(
    (c) => c.name.trim().toLowerCase() !== key,
  );
  const home: NeighborhoodCandidate = {
    name: homeLabel,
    score: 1,
    source: "locality",
    distanceKm: 0,
    lat: pin.lat,
    lon: pin.lon,
  };
  return [home, ...rest];
}

export function promoteListWithHomeFirst(
  merged: NeighborhoodCandidate[],
  pin: VenuePin,
  homeLabel: string | undefined,
  venueCity: string,
  limit = 5,
): PromoteNeighborhood[] {
  const list = homeLabel
    ? prependHomeNeighborhoodCandidate(merged, pin, homeLabel)
    : merged;
  return list.slice(0, limit).map((row, index) => ({
    name: displayNeighborhoodName(row.name, venueCity),
    rank: index + 1,
    lat: row.lat ?? pin.lat,
    lon: row.lon ?? pin.lon,
  }));
}

export function prependHomeToPromoteList(
  list: PromoteNeighborhood[],
  pin: VenuePin,
  homeLabel: string,
): PromoteNeighborhood[] {
  const display = displayNeighborhoodName(homeLabel, pin.city);
  const rest = list
    .filter((n) => n.name.trim().toLowerCase() !== display.trim().toLowerCase())
    .map((n, i) => ({ ...n, rank: i + 2 }));
  return [
    {
      rank: 1,
      name: display,
      lat: pin.lat,
      lon: pin.lon,
    },
    ...rest,
  ].slice(0, 5);
}

export function promoListIncludesHome(
  neighborhoods: Array<{ name: string }>,
  homeLabel: string | undefined,
  venueCity: string,
): boolean {
  if (!homeLabel) return true;
  const homeDisplay = displayNeighborhoodName(homeLabel, venueCity)
    .trim()
    .toLowerCase();
  return neighborhoods.some(
    (n) => n.name.trim().toLowerCase() === homeDisplay,
  );
}
