"use client";

import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { toPng } from "html-to-image";
import { useCallback, useMemo, useRef, useState } from "react";
import type { PitchPayload } from "@/lib/agent/types";
import { ArtistPhoto } from "@/components/artist-photo";
import { HeadlinerHero } from "@/components/headliner-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineupDataView } from "@/components/lineup-data-view";
import { FoodDealsView } from "@/components/food-deals-view";
import { MarketingView } from "@/components/marketing-view";
import { ResultTabs, type ResultTab } from "@/components/result-tabs";
import {
  useVenueInsights,
  type VenueInsightsRequest,
} from "@/hooks/use-venue-insights";
import { readableTagLabels } from "@/lib/agent/step-copy";
import {
  analyticsInputFromPitch,
  usePitchAnalytics,
} from "@/hooks/use-pitch-analytics";
import { slugifyFilename } from "@/lib/copy/slugify";
import { openerOriginMatchesForAct } from "@/lib/lineup/opener-origin-meta";
import { withPosterExportImageCacheBust } from "@/lib/poster-export-images";
import { formatCrowdDisplay } from "@/lib/lineup/crowd-display";
import {
  posterRunWhyKey,
  whyCacheForPosterRun,
  whyLineForAct,
} from "@/lib/lineup/act-why-cache";
import { applyOpenerSwap } from "@/lib/lineup/opener-swap-state";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import { cn } from "@/lib/utils";

const LineupMap = dynamic(
  () => import("@/components/lineup-map").then((m) => m.LineupMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[120px] rounded-md border border-[#e8dfd6] bg-[#f3ece4]" />
    ),
  },
);

type Props = {
  pitch: PitchPayload;
  venue?: { lat: number; lon: number };
  className?: string;
  wideFeed?: boolean;
  previewBadge?: "saved-run" | null;
  animateSettle?: boolean;
};

function cityHintFromAddress(address: string): string | undefined {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return undefined;
  // "134 Shoreditch High St, London" → London; "2509 Main St, Vancouver, BC" → Vancouver
  if (parts.length === 2) return parts[1];
  return parts[parts.length - 2];
}

export function LineupPosterCard({
  pitch: initialPitch,
  venue,
  className,
  wideFeed,
  previewBadge,
  animateSettle,
}: Props) {
  const [pitch, setPitch] = useState(initialPitch);
  const [analyticsRev, setAnalyticsRev] = useState(0);
  const [tab, setTab] = useState<ResultTab>("lineup");
  const [venueTabsOpened, setVenueTabsOpened] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const analyticsInput = analyticsInputFromPitch(pitch);
  const analyticsState = usePitchAnalytics(analyticsInput, analyticsRev);
  const analytics =
    analyticsState.status === "ready" ? analyticsState.data : null;

  const whyByActId = whyCacheForPosterRun(
    posterRunWhyKey(pitch),
    analytics,
  );

  const venueCity =
    pitch.meta?.cityLabel?.trim() || cityHintFromAddress(pitch.address);
  const headlinerWhyLine =
    whyLineForAct(whyByActId, pitch.headliner.id) ??
    analytics?.acts.find((a) => a.id === pitch.headliner.id)?.whyLine ??
    null;
  const openerReachLine = pitch.opener
    ? whyLineForAct(whyByActId, pitch.opener.id) ??
      analytics?.acts.find((a) => a.id === pitch.opener!.id)?.whyLine ??
      null
    : null;

  const swapNext = pitch.openerSwapQueue?.[0];

  const handleSwap = useCallback(() => {
    if (!swapNext || !pitch.opener) return;
    setAnalyticsRev((n) => n + 1);
    setPitch((p) => applyOpenerSwap({ pitch: p, swapNext }));
  }, [pitch.opener, swapNext]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      let dataUrl = "";
      await withPosterExportImageCacheBust(cardRef.current, async () => {
        dataUrl = await toPng(cardRef.current!, {
          cacheBust: true,
          includeQueryParams: true,
          pixelRatio: 2,
          backgroundColor: "#f7f2eb",
          fetchRequestInit: { cache: "no-store" },
          filter: (node) =>
            !(node instanceof HTMLElement && node.dataset.posterExclude),
        });
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${slugifyFilename(pitch.venueLabel)}-lineup.png`;
      a.click();
    } catch {
      /* ignore */
    }
  }, [pitch.venueLabel]);

  const showLocalBadge =
    openerOriginMatchesForAct(pitch, pitch.opener?.id) ||
    analytics?.openerShowLocalBadge === true;

  const crowdLine =
    analytics?.crowdLine?.trim() ||
    formatCrowdDisplay(pitch.crowdDemographics) ||
    null;

  const street = pitch.address.split(",")[0]?.trim() ?? "";
  const styleTags = useMemo(
    () => readableTagLabels(pitch.meta?.tagLabels ?? []).slice(0, 3),
    [pitch.meta?.tagLabels],
  );
  const localActIds = useMemo(
    () =>
      [pitch.headliner.id, pitch.opener?.id].filter(
        (id): id is string =>
          Boolean(id) &&
          (openerOriginMatchesForAct(pitch, id) ||
            (id === pitch.opener?.id && showLocalBadge)),
      ),
    [pitch, showLocalBadge],
  );
  const insightsInput = useMemo<VenueInsightsRequest | null>(() => {
    const cityQuery = pitch.meta?.cityQuery?.trim() || venueCity;
    if (!cityQuery) return null;
    return {
      address: pitch.address,
      cityQuery,
      cityLabel: venueCity || cityQuery,
      concept: pitch.meta?.concept?.trim() || pitch.venueLabel,
      street,
      headliner: { id: pitch.headliner.id, name: pitch.headliner.name },
      opener: pitch.opener
        ? { id: pitch.opener.id, name: pitch.opener.name }
        : null,
      venue: venue ? { lat: venue.lat, lon: venue.lon } : null,
      neighborhoods: pitch.neighborhoods
        .slice(0, 5)
        .map((n) => stripCityFromNeighborhoodLabel(n.name, venueCity)),
      localActIds,
      styleTags,
    };
  }, [pitch, venue, venueCity, street, localActIds, styleTags]);
  const insightsState = useVenueInsights(insightsInput, venueTabsOpened);

  const leadWith = useMemo(() => {
    const chips: string[] = [];
    // "indie folk" and "folk and indie" are one chip, not two.
    const seenWords: Set<string>[] = [];
    for (const t of styleTags) {
      if (seenWords.length >= 2) break;
      const words = new Set(
        t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && w !== "and"),
      );
      if (seenWords.some((w) => [...words].every((x) => w.has(x)))) continue;
      seenWords.push(words);
      chips.push(t.charAt(0).toUpperCase() + t.slice(1));
    }
    const skew = crowdLine?.split("·")[0]?.trim();
    if (skew && skew.length <= 24) chips.push(skew);
    if (pitch.opener) {
      chips.push(
        localActIds.includes(pitch.opener.id)
          ? `Local opener ${pitch.opener.name}`
          : `${pitch.opener.name} opens`,
      );
    }
    if (localActIds.includes(pitch.headliner.id) && venueCity) {
      chips.push(`${venueCity}'s own ${pitch.headliner.name}`);
    }
    if (insightsState.status === "ready") {
      const top = insightsState.places.food.rows.find(
        (r) => r.fans > r.city && r.kind !== "diet",
      );
      if (top) chips.push(`${top.label} crowd`);
    }
    return chips;
  }, [styleTags, crowdLine, pitch.opener, pitch.headliner, localActIds, venueCity, insightsState]);

  const handleTab = useCallback((t: ResultTab) => {
    setTab(t);
    if (t === "food" || t === "marketing") setVenueTabsOpened(true);
  }, []);

  const articleClass = cn(
    "relative mx-auto w-full max-w-xl rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] text-[#1a1614]",
    "shadow-[0_1px_0_rgba(26,22,20,0.06),0_20px_40px_-24px_rgba(26,22,20,0.22)]",
    wideFeed && "max-w-none",
    "ui-poster-compact",
  );

  const posterHeader = (
    <header className="px-5 pt-3 pb-1.5 flex items-start justify-between gap-3 border-b border-[#e0d5ca]">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#8c4a32]">
          One night
        </p>
        <p className="font-heading text-lg leading-tight mt-0.5 truncate">
          {pitch.venueLabel}
        </p>
        <p className="text-xs text-[#6b5c52] mt-0.5 truncate">
          {pitch.address}
        </p>
      </div>
      {previewBadge === "saved-run" && (
        <Badge
          variant="outline"
          className="shrink-0 rounded-full border-[#d4c4b5] text-[#6b5c52] text-[10px] uppercase tracking-wider bg-[#fcf9f5]"
        >
          Saved run
        </Badge>
      )}
    </header>
  );

  return (
    <div className={cn("space-y-3", className)}>
      <ResultTabs value={tab} onChange={handleTab} />

      <motion.div
        initial={animateSettle ? { opacity: 0, y: 10 } : false}
        animate={animateSettle ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <div
          ref={cardRef}
          className={cn("space-y-3", tab !== "lineup" && "hidden")}
          data-tab-panel="lineup"
        >
          <article className={articleClass}>
            {posterHeader}
            <HeadlinerHero
              artist={{
                id: pitch.headliner.id,
                name: pitch.headliner.name,
                tierLabel: "Headliner",
                imageUrl: pitch.headliner.imageUrl,
              }}
              noMatch={false}
              compact
              whyLine={headlinerWhyLine}
            />

            {pitch.opener && (
              <section className="px-5 py-3 flex gap-3 items-center">
                <ArtistPhoto
                  name={pitch.opener.name}
                  imageUrl={pitch.opener.imageUrl}
                  rounded="full"
                  className="h-12 w-12 text-base shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
                      Opener
                    </p>
                    {showLocalBadge && (
                      <Badge className="rounded-full bg-[#8c4a32]/10 text-[#8c4a32] border-0 text-[10px] uppercase tracking-wide hover:bg-[#8c4a32]/10">
                        Local
                      </Badge>
                    )}
                  </div>
                  <p className="font-heading text-lg leading-tight">
                    {pitch.opener.name}
                  </p>
                  {openerReachLine && !pitch.openerWhy?.trim() && (
                    <p className="text-xs text-[#5c534d] mt-0.5">
                      {openerReachLine}
                    </p>
                  )}
                  {pitch.openerWhy?.trim() && (
                    <p className="text-xs text-[#6b5c52] mt-0.5 italic">
                      {pitch.openerWhy.trim()}
                    </p>
                  )}
                </div>
              </section>
            )}
          </article>

          <article className={articleClass}>
            {crowdLine && (
              <p className="px-5 py-2 text-sm text-[#5c534d] border-b border-[#e8dfd6]">
                {crowdLine}
              </p>
            )}

            {pitch.alternates.length > 0 && (
              <section className="px-5 py-2 border-b border-[#e8dfd6] ui-poster-bench">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52] mb-2">
                  Bench
                </p>
                <ul className="flex flex-wrap gap-3 list-none">
                  {pitch.alternates.slice(0, 4).map((a) => (
                    <li key={a.id} className="flex flex-col items-center w-14">
                      <ArtistPhoto
                        name={a.name}
                        imageUrl={a.imageUrl}
                        rounded="full"
                        className="h-8 w-8 text-[10px]"
                      />
                      <span className="text-[10px] text-center line-clamp-2 mt-0.5">
                        {a.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pitch.neighborhoods.length > 0 && (
              <section className="px-5 py-3 space-y-2 ui-poster-map clear-both">
                {venue && tab === "lineup" && (
                  <LineupMap
                    lineup={{
                      venue: { ...venue, city: "Venue" },
                      neighborhoods: pitch.neighborhoods,
                    }}
                    className="h-[132px] lg:h-[132px] relative z-0"
                  />
                )}
                <ol className="ui-poster-map-legend grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-0.5 list-none text-xs">
                  {pitch.neighborhoods.map((n) => (
                    <li key={n.rank} className="flex gap-1.5">
                      <span className="text-[#8c4a32]">#{n.rank}</span>
                      <span className="font-heading truncate">
                        {stripCityFromNeighborhoodLabel(n.name, venueCity)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <div
              data-poster-exclude="true"
              className="flex flex-wrap gap-3 px-5 pt-3 pb-3.5 border-t border-[#e8dfd6]"
            >
              {swapNext && pitch.opener && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-[#e0d5ca] text-sm"
                  onClick={handleSwap}
                >
                  Swap opener — {swapNext.name}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-[#e0d5ca] text-sm"
                onClick={handleDownload}
              >
                Download poster
              </Button>
            </div>
          </article>
        </div>

        {tab === "food" && (
          <FoodDealsView
            state={insightsState}
            headlinerName={pitch.headliner.name}
            cityLabel={
              (insightsState.status === "ready" && insightsState.places.cityLabel) ||
              insightsInput?.cityLabel ||
              venueCity ||
              ""
            }
          />
        )}

        {tab === "marketing" && (
          <MarketingView
            state={insightsState}
            pitch={pitch}
            cityLabel={insightsInput?.cityLabel ?? venueCity ?? ""}
            street={street}
            leadWith={leadWith}
          />
        )}

        {tab === "data" && (
          <article className={articleClass} data-tab-panel="data">
            <LineupDataView
              pitch={pitch}
              analytics={analytics}
            />
          </article>
        )}
      </motion.div>
    </div>
  );
}
