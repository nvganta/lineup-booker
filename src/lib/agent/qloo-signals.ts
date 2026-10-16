import { toSignalLocationPoint } from "@/lib/geocode/nominatim";
import type { VenuePin } from "@/lib/lineup/geography";
import type { VenueSignals } from "@/lib/lineup/translate-venue";

export function headlinerDiscoverySignals(
  pin: VenuePin,
  address: string,
  tagIds: string[],
  tagLabels: string[],
): Pick<
  VenueSignals,
  | "locationQuery"
  | "cityForHeatmap"
  | "regionState"
  | "country"
  | "signalLocationPoint"
  | "locationMode"
  | "venuePin"
  | "musicTagIds"
  | "tagIds"
  | "tagLabels"
  | "signalSummary"
> {
  return {
    locationQuery: address,
    cityForHeatmap: pin.city,
    regionState: pin.state,
    country: pin.country,
    signalLocationPoint: toSignalLocationPoint(pin.lon, pin.lat),
    locationMode: "point",
    venuePin: pin,
    musicTagIds: tagIds,
    tagIds,
    tagLabels,
    signalSummary: tagIds.join(","),
  };
}
