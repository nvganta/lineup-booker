// Client-safe: no geocoder or Node imports, so the compare view can run it.
import type { Mark, Point } from "@/lib/compare/without-qloo";
import { haversineKm } from "@/lib/geo/haversine";

function nameKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Same area as a Qloo pick: same name, or geocoded within this distance of its pin.
 * Tight on purpose: Gastown's centroid is 0.5 km from Downtown Eastside's.
 */
const SAME_AREA_KM = 0.4;

/** Does a plain neighbourhood land on one of Qloo's fan-heat picks? Uses data already on the page. */
export function markAgainstQloo(
  name: string,
  point: Point | null,
  qloo: Array<{ rank: number; name: string; lat?: number; lon?: number }>,
): Mark | null {
  const hit =
    qloo.find((q) => nameKey(q.name) === nameKey(name)) ??
    (point
      ? qloo.find((q) => q.lat != null && q.lon != null && haversineKm(point.lat, point.lon, q.lat, q.lon) <= SAME_AREA_KM)
      : undefined);
  if (hit) return { ok: true, text: `Qloo #${hit.rank}` };
  return point ? { ok: false, soft: true, text: "not in Qloo's top 5" } : null;
}
