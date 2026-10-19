import { NextResponse } from "next/server";
import { z } from "zod";
import {
  displayCityLabelFromGeocode,
  geocodeWithRetries,
} from "@/lib/geocode/nominatim";
import { fetchPlaceInsights } from "@/lib/venue/place-insights";

const bodySchema = z.object({
  cityQuery: z.string().min(1).max(120),
  cityLabel: z.string().min(1).max(120),
  headlinerId: z.string().min(1).max(80),
  address: z.string().max(240).optional(),
  venue: z
    .object({ lat: z.number().finite(), lon: z.number().finite() })
    .nullable()
    .optional(),
});

/** Qloo place data for the Food & deals and Marketing tabs (three lookups, cached). */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = parsed.data;
  let venue = b.venue ?? null;
  let cityQuery = b.cityQuery;
  let cityLabel = b.cityLabel;
  // Backup pitch paths can arrive without a venue pin or a real city; look
  // the typed address up once (Nominatim, cached) rather than guess.
  const cityLooksWrong = /^\d/.test(cityQuery.trim());
  if ((!venue || cityLooksWrong) && b.address) {
    try {
      const hit = await geocodeWithRetries(b.address);
      if (hit) {
        venue ??= { lat: hit.lat, lon: hit.lon };
        if (cityLooksWrong) {
          cityQuery = hit.cityForHeatmap || displayCityLabelFromGeocode(hit);
          cityLabel = displayCityLabelFromGeocode(hit) || cityQuery;
        }
      }
    } catch {
      // keep what we have; the tab says when nearby data is missing
    }
  }
  try {
    const places = await fetchPlaceInsights({
      cityQuery,
      cityLabel,
      headlinerId: b.headlinerId,
      venue,
    });
    return NextResponse.json({ places });
  } catch (err) {
    console.error("[venue-insights]", err instanceof Error ? err.message : "error");
    return NextResponse.json({ error: "Insights unavailable" }, { status: 503 });
  }
}
