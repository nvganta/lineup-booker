import { qlooGet } from "@/lib/qloo/client";
import type { QlooEntity, QlooInsightsResponse } from "@/lib/qloo/types";

/** Place categories that cover "where they eat and drink". */
const EAT_DRINK_TAGS =
  "urn:tag:category:place:restaurant,urn:tag:category:place:bar";

const SAMPLE_SIZE = 15;
export const NEAR_RADIUS_M = 1500;
/** Below this many places on either side the comparison isn't worth showing. */
const MIN_COMPARE_SAMPLE = 8;
const MIN_NEAR_SPOTS = 3;

export type PlaceTag = { name: string; type: string };

export type PlaceRow = {
  id: string;
  name: string;
  address?: string;
  /** Qloo's own city for the place (e.g. "Brooklyn" inside New York). */
  placeCity?: string;
  tags: PlaceTag[];
};

export type TasteKind = "drink" | "food" | "late" | "diet";

export type TasteCountRow = {
  label: string;
  kind: TasteKind;
  /** Places among the fans' top places carrying this tag. */
  fans: number;
  /** Places among the city's top places carrying this tag. */
  city: number;
};

export type NearSpot = {
  id: string;
  name: string;
  street: string;
  kinds: string[];
  eatDrink: boolean;
};

export type DataStatus = "ok" | "sparse" | "unavailable";

export type PlaceInsights = {
  cityLabel: string;
  food: {
    status: DataStatus;
    fanSample: number;
    citySample: number;
    rows: TasteCountRow[];
  };
  near: {
    status: DataStatus;
    radiusKm: number;
    spots: NearSpot[];
  };
  lookups: { made: number; cached: number };
};

export type PlaceInsightsInput = {
  cityQuery: string;
  cityLabel: string;
  headlinerId: string;
  venue?: { lat: number; lon: number } | null;
};

function entityId(e: QlooEntity): string {
  return e.entity_id ?? e.id ?? e.name;
}

function placeCityOf(e: QlooEntity): string | undefined {
  const geo = (e.properties as { geocode?: { city?: unknown } } | undefined)?.geocode;
  return typeof geo?.city === "string" && geo.city.trim() ? geo.city.trim() : undefined;
}

function addressOf(e: QlooEntity): string | undefined {
  const raw = (e.properties as { address?: unknown } | undefined)?.address;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export function toPlaceRows(data: QlooInsightsResponse | undefined): PlaceRow[] {
  const seen = new Set<string>();
  const rows: PlaceRow[] = [];
  for (const e of data?.results?.entities ?? []) {
    const id = entityId(e);
    if (!e.name || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      name: e.name.trim(),
      address: addressOf(e),
      placeCity: placeCityOf(e),
      tags: (e.tags ?? [])
        .filter((t): t is { name: string; type: string } =>
          Boolean(t?.name && t?.type),
        )
        .map((t) => ({ name: t.name.trim(), type: t.type })),
    });
  }
  return rows;
}

const FOOD_DRINK_NAME =
  /bar|pub|brew|beer|wine|cider|cocktail|spirit|distill|caf[eé]|coffee|tea\b|bakery|diner|pizza|taco|burger|bbq|barbecue|noodle|ramen|sushi|deli|food|kitchen|grill|brunch|dessert|ice cream|bagel|sandwich|wings|chicken|seafood|oyster|steak|vegan|vegetarian|gluten|tapas|small plates|late night/i;

const GENERIC_GENRE =
  /^(restaurant|place|point of interest|tourist attraction|establishment|food|store|shop|shopping|event venue|bar|night life|nightlife)$/i;

/** Venue types specific enough to read as a taste ("Brewery", not "Bar"). */
const SPECIFIC_DRINK_GENRE =
  /brew|beer|cider|cocktail|wine bar|pub\b|dive bar|distill|speakeasy|tap ?room/i;
const SPECIFIC_FOOD_GENRE =
  /taco|pizza|burger|diner|bakery|bbq|barbecue|ramen|noodle|sushi|deli|bagel|wings|chicken|oyster|tapas|food truck/i;

/** Which Qloo tag types count as a food or drink preference. */
function tasteLabel(tag: PlaceTag): { label: string; kind: TasteKind } | null {
  const type = tag.type;
  const name = tag.name;
  if (type === "urn:tag:cuisine:qloo") {
    return /^(american|canadian|british|international|fusion)$/i.test(name)
      ? null
      : { label: name, kind: "food" };
  }
  if (type === "urn:tag:beverage_offering:qloo") return { label: name, kind: "drink" };
  if (type === "urn:tag:dietary_option:qloo") {
    return /^(vegetarian|vegan|gluten free)$/i.test(name)
      ? { label: name, kind: "diet" }
      : null;
  }
  if (type === "urn:tag:time_of_day_fit:qloo") {
    return /late night/i.test(name) ? { label: "Late night", kind: "late" } : null;
  }
  if (type === "urn:tag:interests:qloo") {
    if (/beer|wine|cider|cocktail|mixology|spirit|whisk|coffee/i.test(name)) {
      return { label: name, kind: "drink" };
    }
    return null;
  }
  if (type === "urn:tag:genre:place") {
    if (GENERIC_GENRE.test(name)) return null;
    if (SPECIFIC_DRINK_GENRE.test(name)) return { label: name, kind: "drink" };
    if (SPECIFIC_FOOD_GENRE.test(name)) return { label: name, kind: "food" };
  }
  return null;
}

type Count = { label: string; kind: TasteKind; n: number };

function tasteCounts(rows: PlaceRow[]): Map<string, Count> {
  const counts = new Map<string, Count>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const tag of row.tags) {
      const t = tasteLabel(tag);
      if (!t) continue;
      const key = t.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const hit = counts.get(key);
      if (hit) hit.n += 1;
      else counts.set(key, { ...t, n: 1 });
    }
  }
  return counts;
}

/**
 * Tag counts where the fans' places differ most from the city's top places.
 * Plain counts of places tagged, never a score.
 */
export function compareTasteCounts(
  fans: PlaceRow[],
  city: PlaceRow[],
  maxRows = 5,
): TasteCountRow[] {
  const f = tasteCounts(fans);
  const c = tasteCounts(city);
  const keys = new Set([...f.keys(), ...c.keys()]);
  const rows: Array<TasteCountRow & { diff: number }> = [];
  for (const key of keys) {
    const fn = f.get(key)?.n ?? 0;
    const cn = c.get(key)?.n ?? 0;
    const diff = fn - cn;
    if (Math.max(fn, cn) < 3 || Math.abs(diff) < 2) continue;
    const meta = f.get(key) ?? c.get(key)!;
    rows.push({
      label: meta.label,
      kind: meta.kind,
      fans: fn,
      city: cn,
      diff,
    });
  }
  const byGap = (a: { diff: number }, b: { diff: number }) =>
    Math.abs(b.diff) - Math.abs(a.diff);
  const ups = rows.filter((r) => r.diff > 0).sort(byGap);
  const downs = rows.filter((r) => r.diff < 0).sort(byGap);
  // One dietary row at most, so "gluten free" can't crowd out food and drink.
  let diet = 0;
  const capDiet = (r: { kind: TasteKind }) =>
    r.kind !== "diet" || diet++ === 0;
  const pickDowns = downs.filter(capDiet).slice(0, 2);
  const pickUps = ups.filter(capDiet).slice(0, maxRows - pickDowns.length);
  return [...pickUps, ...pickDowns].map((r) => ({
    label: r.label,
    kind: r.kind,
    fans: r.fans,
    city: r.city,
  }));
}

function streetFromAddress(
  address: string | undefined,
  cities: Array<string | undefined>,
): string {
  if (!address) return "";
  let street = address;
  for (const raw of cities) {
    const city = raw?.trim();
    if (!city) continue;
    const idx = street.toLowerCase().indexOf(` ${city.toLowerCase()}`);
    if (idx > 0) street = street.slice(0, idx);
  }
  const comma = street.indexOf(",");
  if (comma > 0) street = street.slice(0, comma);
  return street.trim();
}

const SPOT_GENERIC_GENRE =
  /^(restaurant|place|point of interest|establishment|shopping|store|shop|tourist attraction)$/i;

const NON_FLYER_GENRE =
  /^(park|playground|garden|beach|trail|landmark|historical landmark|monument|building|office|parking|bus stop|transit station|school|church|hospital|apartment|residential|convention cent|banquet hall|wedding venue|exhibition|fairground|stadium|arena|hotel|conference)/i;

export function toNearSpots(rows: PlaceRow[], cityLabel: string): NearSpot[] {
  const spots: NearSpot[] = [];
  for (const row of rows) {
    const genres = row.tags
      .filter((t) => t.type === "urn:tag:genre:place")
      .map((t) => t.name)
      .filter((n, i, a) => a.indexOf(n) === i && !SPOT_GENERIC_GENRE.test(n));
    if (genres.length === 0) continue;
    if (genres.some((g) => NON_FLYER_GENRE.test(g))) continue;
    const eatDrink =
      genres.some((g) => FOOD_DRINK_NAME.test(g)) ||
      row.tags.some(
        (t) => t.type === "urn:tag:category:place" && /restaurant|bar/i.test(t.name),
      );
    spots.push({
      id: row.id,
      name: row.name,
      street: streetFromAddress(row.address, [row.placeCity, cityLabel]),
      kinds: genres.slice(0, 3),
      eatDrink,
    });
  }
  return spots;
}

async function placeQuery(
  params: Record<string, string | number>,
  lookups: { made: number; cached: number },
): Promise<PlaceRow[] | null> {
  try {
    const { data, cached } = await qlooGet<QlooInsightsResponse>(
      "/v2/insights",
      { "filter.type": "urn:entity:place", take: SAMPLE_SIZE, ...params },
    );
    if (cached) lookups.cached += 1;
    else lookups.made += 1;
    return toPlaceRows(data);
  } catch {
    lookups.made += 1;
    return null;
  }
}

/**
 * Three Qloo place lookups: the headliner's fans' restaurants and bars in the
 * city, the city's own top restaurants and bars (same URL for every run in that
 * city, so it caches), and the fans' places within 1.5 km of the venue.
 */
export async function fetchPlaceInsights(
  input: PlaceInsightsInput,
): Promise<PlaceInsights> {
  const lookups = { made: 0, cached: 0 };
  const city = input.cityQuery;
  const venue = input.venue;

  const [fans, cityTop, near] = await Promise.all([
    placeQuery(
      {
        "filter.tags": EAT_DRINK_TAGS,
        "operator.filter.tags": "union",
        "filter.location.query": city,
        "signal.interests.entities": input.headlinerId,
      },
      lookups,
    ),
    placeQuery(
      {
        "filter.tags": EAT_DRINK_TAGS,
        "operator.filter.tags": "union",
        "filter.location.query": city,
        "signal.location.query": city,
      },
      lookups,
    ),
    venue && Number.isFinite(venue.lat) && Number.isFinite(venue.lon)
      ? placeQuery(
          {
            "filter.location": `POINT(${venue.lon.toFixed(4)} ${venue.lat.toFixed(4)})`,
            "filter.location.radius": NEAR_RADIUS_M,
            "signal.interests.entities": input.headlinerId,
          },
          lookups,
        )
      : Promise.resolve(null),
  ]);

  let foodStatus: DataStatus = "unavailable";
  let rows: TasteCountRow[] = [];
  if (fans && cityTop) {
    if (fans.length < MIN_COMPARE_SAMPLE || cityTop.length < MIN_COMPARE_SAMPLE) {
      foodStatus = "sparse";
    } else {
      rows = compareTasteCounts(fans, cityTop);
      foodStatus = rows.length >= 2 ? "ok" : "sparse";
    }
  }

  let nearStatus: DataStatus = "unavailable";
  let spots: NearSpot[] = [];
  if (near) {
    spots = toNearSpots(near, input.cityLabel);
    nearStatus = spots.length >= MIN_NEAR_SPOTS ? "ok" : "sparse";
  }

  return {
    cityLabel: input.cityLabel,
    food: {
      status: foodStatus,
      fanSample: fans?.length ?? 0,
      citySample: cityTop?.length ?? 0,
      rows: foodStatus === "ok" ? rows : [],
    },
    near: { status: nearStatus, radiusKm: NEAR_RADIUS_M / 1000, spots },
    lookups,
  };
}
