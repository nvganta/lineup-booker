"use client";

import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { toPng } from "html-to-image";
import { useCallback, useRef, useState } from "react";
import type { PitchPayload } from "@/lib/agent/types";
import { ArtistPhoto } from "@/components/artist-photo";
import { HeadlinerHero } from "@/components/headliner-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineupDataView } from "@/components/lineup-data-view";
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
  const [tab, setTab] = useState<"lineup" | "data">("lineup");
  const cardRef = useRef<HTMLElement>(null);
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

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("lineup")}
          className={cn(
            "rounded-full px-3 py-1 text-xs uppercase tracking-wider border",
            tab === "lineup"
              ? "border-[#8c4a32]/40 bg-[#8c4a32]/10 text-[#1a1614]"
              : "border-[#e0d5ca] text-[#6b5c52]",
          )}
        >
          Lineup
        </button>
        <button
          type="button"
          onClick={() => setTab("data")}
          className={cn(
            "rounded-full px-3 py-1 text-xs uppercase tracking-wider border",
            tab === "data"
              ? "border-[#8c4a32]/40 bg-[#8c4a32]/10 text-[#1a1614]"
              : "border-[#e0d5ca] text-[#6b5c52]",
          )}
        >
          Data
        </button>
      </div>

      <motion.div
        initial={animateSettle ? { opacity: 0, y: 10 } : false}
        animate={animateSettle ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
      <article
        ref={cardRef}
        className={cn(
          "relative mx-auto w-full max-w-xl rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] text-[#1a1614]",
          "shadow-[0_1px_0_rgba(26,22,20,0.06),0_20px_40px_-24px_rgba(26,22,20,0.22)]",
          wideFeed && "max-w-none",
          "ui-poster-compact",
        )}
      >
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

        {tab === "lineup" ? (
          <>
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
              <section className="px-5 py-3 flex gap-3 items-center border-b border-[#e8dfd6]">
                <ArtistPhoto
                  name={pitch.opener.name}
                  imageUrl={pitch.opener.imageUrl}
                  rounded="full"
                  className="h-12 w-12 text-base shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
                      {showLocalBadge ? "Local opener" : "Opener"}
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
                  {openerReachLine && (
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
                {venue && (
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
          </>
        ) : (
          <LineupDataView
            pitch={pitch}
            analytics={analytics}
            venue={venue}
            wideFeed={wideFeed}
          />
        )}
      </article>
      </motion.div>

      <div className="flex flex-wrap gap-3">
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
    </div>
  );
}
