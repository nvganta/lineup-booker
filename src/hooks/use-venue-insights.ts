"use client";

import { useEffect, useMemo, useState } from "react";
import type { DraftedCopy } from "@/lib/venue/drafted-copy";
import type { PlaceInsights } from "@/lib/venue/place-insights";

export type VenueInsightsRequest = {
  address: string;
  cityQuery: string;
  cityLabel: string;
  concept: string;
  street: string;
  headliner: { id: string; name: string };
  opener: { id: string; name: string } | null;
  venue: { lat: number; lon: number } | null;
  neighborhoods: string[];
  localActIds: string[];
  styleTags: string[];
};

export type CopyState =
  | { status: "loading" }
  | { status: "ready"; copy: DraftedCopy }
  | { status: "error" };

export type VenueInsightsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; places: PlaceInsights; copy: CopyState }
  | { status: "error" };

const placesMemo = new Map<string, PlaceInsights>();
const copyMemo = new Map<string, DraftedCopy>();

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return (await res.json()) as T;
}

function copyBody(input: VenueInsightsRequest, places: PlaceInsights) {
  const local = new Set(input.localActIds);
  return {
    headliner: input.headliner.name,
    opener: input.opener?.name ?? null,
    cityLabel: places.cityLabel || input.cityLabel,
    concept: input.concept,
    street: input.street,
    neighborhoods: input.neighborhoods,
    localActs: [input.headliner, input.opener]
      .filter((a): a is { id: string; name: string } => Boolean(a && local.has(a.id)))
      .map((a) => a.name),
    styleTags: input.styleTags,
    rows: places.food.status === "ok" ? places.food.rows : [],
    fanSample: places.food.fanSample,
    citySample: places.food.citySample,
    nearEatDrink: places.near.spots
      .filter((s) => s.eatDrink)
      .map((s) => s.name)
      .slice(0, 4),
  };
}

/**
 * Place data first (Qloo), then the drafted copy (model). Fetches only once
 * `enabled` turns true, i.e. on the first open of Food & deals or Marketing.
 */
export function useVenueInsights(
  input: VenueInsightsRequest | null,
  enabled: boolean,
): VenueInsightsState {
  const placesKey = useMemo(
    () =>
      input
        ? JSON.stringify({
            cityQuery: input.cityQuery,
            cityLabel: input.cityLabel,
            headlinerId: input.headliner.id,
            venue: input.venue,
            address: input.address,
          })
        : "",
    [input],
  );
  const fullKey = useMemo(() => (input ? JSON.stringify(input) : ""), [input]);
  const [places, setPlaces] = useState<{ key: string; v: PlaceInsights | "error" } | null>(null);
  const [copy, setCopy] = useState<{ key: string; v: DraftedCopy | "error" } | null>(null);

  useEffect(() => {
    if (!placesKey || !enabled) return;
    let cancelled = false;
    const hit = placesMemo.get(placesKey);
    const run = hit
      ? Promise.resolve(hit)
      : postJson<{ places: PlaceInsights }>("/api/venue-insights", JSON.parse(placesKey)).then(
          (r) => {
            placesMemo.set(placesKey, r.places);
            return r.places;
          },
        );
    run
      .then((v) => !cancelled && setPlaces({ key: placesKey, v }))
      .catch(() => !cancelled && setPlaces({ key: placesKey, v: "error" }));
    return () => {
      cancelled = true;
    };
  }, [placesKey, enabled]);

  const placesReady =
    places && places.key === placesKey && places.v !== "error" ? places.v : null;

  useEffect(() => {
    if (!input || !placesReady || !fullKey) return;
    let cancelled = false;
    const hit = copyMemo.get(fullKey);
    const run = hit
      ? Promise.resolve(hit)
      : postJson<{ copy: DraftedCopy }>("/api/venue-copy", copyBody(input, placesReady)).then(
          (r) => {
            copyMemo.set(fullKey, r.copy);
            return r.copy;
          },
        );
    run
      .then((v) => !cancelled && setCopy({ key: fullKey, v }))
      .catch(() => !cancelled && setCopy({ key: fullKey, v: "error" }));
    return () => {
      cancelled = true;
    };
    // input is captured through fullKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey, placesReady]);

  if (!input) return { status: "idle" };
  if (!places || places.key !== placesKey) {
    return enabled ? { status: "loading" } : { status: "idle" };
  }
  if (places.v === "error") return { status: "error" };
  const copyState: CopyState =
    copy && copy.key === fullKey
      ? copy.v === "error"
        ? { status: "error" }
        : { status: "ready", copy: copy.v }
      : { status: "loading" };
  return { status: "ready", places: places.v, copy: copyState };
}
