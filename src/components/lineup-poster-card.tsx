"use client";

import { AnimatePresence, animate, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  crowdGenderLean,
  crowdTopPositiveAgeRow,
  formatCrowdDisplay,
} from "@/lib/lineup/crowd-display";
import { formatSkewIndex } from "@/lib/lineup/crowd-skew-display";
import { drawLine } from "@/lib/lineup/draw-line";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";
import {
  posterRunWhyKey,
  whyCacheForPosterRun,
  whyLineForAct,
} from "@/lib/lineup/act-why-cache";
import { applyOpenerSwap } from "@/lib/lineup/opener-swap-state";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import { CompareSwitch, WithoutQlooView } from "@/components/without-qloo-view";
import { BookItView } from "@/components/book-it-view";
import { ENTER, fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Props = {
  pitch: PitchPayload;
  venue?: { lat: number; lon: number };
  className?: string;
  wideFeed?: boolean;
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b5c52] mb-2">
      {children}
    </p>
  );
}

/** Where the act sits on Qloo's reach scale, as a bar with the tier in words. */
function DrawMeter({ popularity, capacity }: { popularity?: number; capacity?: number }) {
  const draw = drawLine(popularity, capacity);
  if (!draw) return null;
  return (
    <div className="mt-3" data-draw-line>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-[#1a1614]">{draw.label}</p>
        <span className="text-[11px] tabular-nums text-[#8a7f76]">
          {draw.percentile}/100 reach
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-[#e8dfd6]" aria-hidden>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#8c4a32]"
          style={{ width: `${draw.percentile}%` }}
        />
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-[#5c534d]">{draw.line}</p>
    </div>
  );
}

export function LineupPosterCard({
  pitch: initialPitch,
  venue,
  className,
  wideFeed,
  animateSettle,
}: Props) {
  const [pitch, setPitch] = useState(initialPitch);
  // A different lineup for the same room keeps this card mounted (same key),
  // so take the new pitch rather than showing the old one.
  const [shownPitch, setShownPitch] = useState(initialPitch);
  if (initialPitch !== shownPitch) {
    setShownPitch(initialPitch);
    setPitch(initialPitch);
  }
  const [analyticsRev, setAnalyticsRev] = useState(0);
  const [tab, setTab] = useState<ResultTab>("lineup");
  const [venueTabsOpened, setVenueTabsOpened] = useState(false);
  const [compare, setCompare] = useState(false);
  const [booking, setBooking] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const analyticsInput = analyticsInputFromPitch(pitch);
  const analyticsState = usePitchAnalytics(analyticsInput, analyticsRev);
  const analytics =
    analyticsState.status === "ready" ? analyticsState.data : null;

  const whyByActId = whyCacheForPosterRun(posterRunWhyKey(pitch), analytics);
  const whyFor = useCallback(
    (id: string) =>
      whyLineForAct(whyByActId, id) ??
      analytics?.acts.find((a) => a.id === id)?.whyLine ??
      null,
    [whyByActId, analytics],
  );

  const venueCity =
    pitch.meta?.cityLabel?.trim() || cityHintFromAddress(pitch.address);
  const headlinerWhyLine = whyFor(pitch.headliner.id);
  const openerReachLine = pitch.opener ? whyFor(pitch.opener.id) : null;
  const capacity = popularityBandFromConcept(
    pitch.meta?.concept?.trim() || pitch.venueLabel,
  ).seatCapacity;

  const handleSwap = useCallback(
    (swapNext: NonNullable<PitchPayload["openerSwapQueue"]>[number]) => {
      if (!pitch.opener) return;
      setAnalyticsRev((n) => n + 1);
      setPitch((p) => applyOpenerSwap({ pitch: p, swapNext }));
    },
    [pitch.opener],
  );

  const showLocalBadge =
    openerOriginMatchesForAct(pitch, pitch.opener?.id) ||
    analytics?.openerShowLocalBadge === true;

  const demographics = analytics?.demographics ?? pitch.crowdDemographics ?? null;
  const crowdLine =
    analytics?.crowdLine?.trim() || formatCrowdDisplay(demographics) || null;
  const topAge = crowdTopPositiveAgeRow(demographics);
  const genderLean = crowdGenderLean(demographics?.gender ?? null);
  const genderValue =
    genderLean === "female"
      ? demographics?.gender?.female
      : genderLean === "male"
        ? demographics?.gender?.male
        : undefined;

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
        t
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w && w !== "and"),
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
  }, [
    styleTags,
    crowdLine,
    pitch.opener,
    pitch.headliner,
    localActIds,
    venueCity,
    insightsState,
  ]);

  const plainForm = useMemo(
    () => ({
      concept: pitch.meta?.concept?.trim() || pitch.venueLabel,
      address: pitch.address,
      regulars: pitch.meta?.regularsLove?.trim() || "",
    }),
    [
      pitch.meta?.concept,
      pitch.meta?.regularsLove,
      pitch.venueLabel,
      pitch.address,
    ],
  );
  const bookingInput = useMemo(
    () => ({
      headliner: pitch.headliner.name,
      opener: pitch.opener?.name ?? null,
      venueLabel: pitch.venueLabel,
      address: pitch.address,
      cityLabel: insightsInput?.cityLabel ?? venueCity ?? "",
      neighborhoods: insightsInput?.neighborhoods ?? [],
      styleTags,
      rows: [],
    }),
    [
      pitch.headliner.name,
      pitch.opener?.name,
      pitch.venueLabel,
      pitch.address,
      insightsInput,
      venueCity,
      styleTags,
    ],
  );
  const handleBook = useCallback(() => {
    setBooking(true);
    setCompare(false);
    setVenueTabsOpened(true);
  }, []);

  // The lineup panel stays mounted and is only hidden, so coming back to it
  // replays the same fade the other panels get on mount.
  const lineupVisible = tab === "lineup" && !compare && !booking;
  const lineupShownOnce = useRef(lineupVisible);
  useEffect(() => {
    if (!lineupVisible || !cardRef.current) return;
    if (!lineupShownOnce.current) {
      lineupShownOnce.current = true;
      return;
    }
    animate(cardRef.current, { opacity: [0, 1], y: [6, 0] }, ENTER);
  }, [lineupVisible]);

  const handleTab = useCallback((t: ResultTab) => {
    setTab(t);
    if (t === "food" || t === "marketing") setVenueTabsOpened(true);
  }, []);

  const qlooCallCount =
    (pitch.qlooCalls?.length ?? 0) + (analytics?.qlooCalls?.length ?? 0);
  const otherOpeners = (pitch.openerSwapQueue ?? []).slice(0, 3);
  const alternates = pitch.alternates.slice(0, 4);

  const articleClass = cn(
    "relative mx-auto w-full max-w-xl rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] text-[#1a1614]",
    "shadow-[0_1px_0_rgba(26,22,20,0.06),0_20px_40px_-24px_rgba(26,22,20,0.22)]",
    wideFeed && "max-w-none",
  );

  return (
    <div className={cn("space-y-3", className)}>
      <ResultTabs value={tab} onChange={handleTab} />
      {tab === "lineup" && !booking && (
        <div className="flex justify-end -mt-1">
          <CompareSwitch on={compare} onChange={setCompare} />
        </div>
      )}

      <motion.div
        initial={animateSettle ? { opacity: 0, y: 10 } : false}
        animate={animateSettle ? { opacity: 1, y: 0 } : undefined}
        transition={{ ...ENTER, duration: 0.45 }}
      >
        <div
          ref={cardRef}
          className={cn(!lineupVisible && "hidden")}
          data-tab-panel="lineup"
        >
          <article className={articleClass}>
            <header className="px-5 pt-3.5 pb-3 flex items-start justify-between gap-3 border-b border-[#e0d5ca]">
              <div className="min-w-0">
                <p className="font-heading text-lg leading-tight truncate">
                  {pitch.venueLabel}
                </p>
                <p className="text-xs text-[#6b5c52] mt-0.5 truncate">
                  {pitch.address}
                </p>
              </div>
              {qlooCallCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleTab("data")}
                  className="shrink-0 rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-2.5 py-1 text-[11px] text-[#6b5c52] hover:text-[#8c4a32] hover:border-[#8c4a32]/40 transition-colors cursor-pointer"
                  data-qloo-count
                >
                  {qlooCallCount} Qloo lookups
                </button>
              )}
            </header>

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
            >
              <DrawMeter
                popularity={pitch.meta?.headlinerPopularity}
                capacity={capacity}
              />
            </HeadlinerHero>

            <AnimatePresence mode="popLayout" initial={false}>
              {pitch.opener && (
                <motion.section
                  key={pitch.opener.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={ENTER}
                  className="px-5 py-4 border-b border-[#e8dfd6]"
                >
                  <div className="flex gap-3 items-start">
                    <ArtistPhoto
                      name={pitch.opener.name}
                      imageUrl={pitch.opener.imageUrl}
                      rounded="full"
                      className="h-12 w-12 text-base shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b5c52]">
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
                      <p className="text-xs text-[#5c534d] mt-0.5">
                        {pitch.openerWhy?.trim() || openerReachLine}
                      </p>
                    </div>
                  </div>
                  {otherOpeners.length > 0 && (
                    <div className="mt-3 pl-[60px]">
                      <p className="text-[11px] text-[#8a7f76] mb-1.5">
                        Or open with
                      </p>
                      <ul className="flex flex-wrap gap-1.5 list-none">
                        {otherOpeners.map((o) => (
                          <li key={o.id}>
                            <button
                              type="button"
                              onClick={() => handleSwap(o)}
                              title={o.reason}
                              data-swap-opener={o.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#e0d5ca] bg-[#fcf9f5] pl-1 pr-2.5 py-1 text-[12px] text-[#1a1614] hover:border-[#8c4a32]/40 hover:bg-[#f7f2eb] transition-colors cursor-pointer"
                            >
                              <ArtistPhoto
                                name={o.name}
                                imageUrl={o.imageUrl}
                                rounded="full"
                                className="h-5 w-5 text-[8px]"
                              />
                              {o.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {alternates.length > 0 && (
              <section className="px-5 py-4 border-b border-[#e8dfd6]">
                <SectionLabel>Also fits your room</SectionLabel>
                <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 list-none">
                  {alternates.map((a) => {
                    const why = whyFor(a.id);
                    return (
                      <li
                        key={a.id}
                        className="flex gap-2.5 items-start min-w-0"
                        title={why ?? undefined}
                      >
                        <ArtistPhoto
                          name={a.name}
                          imageUrl={a.imageUrl}
                          rounded="full"
                          className="h-9 w-9 text-[11px] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-tight text-[#1a1614] line-clamp-2">
                            {a.name}
                          </p>
                          {why && (
                            <p className="text-[11px] leading-snug text-[#8a7f76] mt-0.5 line-clamp-2">
                              {why}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {(topAge || genderLean) && (
              <section className="px-5 py-4 border-b border-[#e8dfd6]" data-crowd>
                <SectionLabel>Who&apos;ll come</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {topAge && (
                    <span
                      className="inline-flex items-baseline gap-1.5 rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-3 py-1.5 text-[13px] text-[#1a1614]"
                      title={`Qloo skew ${formatSkewIndex(topAge.value)} for ages ${topAge.label}`}
                    >
                      Ages {topAge.label}
                      <span className="text-[11px] tabular-nums text-[#8c4a32]">
                        {formatSkewIndex(topAge.value)}
                      </span>
                    </span>
                  )}
                  {genderLean && (
                    <span
                      className="inline-flex items-baseline gap-1.5 rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-3 py-1.5 text-[13px] text-[#1a1614]"
                      title={
                        genderValue != null
                          ? `Qloo skew ${formatSkewIndex(genderValue)} ${genderLean}`
                          : undefined
                      }
                    >
                      Leans {genderLean}
                      {genderValue != null && (
                        <span className="text-[11px] tabular-nums text-[#8c4a32]">
                          {formatSkewIndex(genderValue)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-[#8a7f76]">
                  Qloo audience skew for {pitch.headliner.name} fans
                  {venueCity ? ` in ${venueCity}` : ""}. Positive means more than
                  the city average.
                </p>
              </section>
            )}

            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <Button
                type="button"
                className="rounded-full bg-[#8c4a32] hover:bg-[#7a3f2a] text-white text-sm"
                onClick={handleBook}
                data-book-it
              >
                Book it
              </Button>
              <p className="text-[12px] text-[#8a7f76]">
                Drafts the booking email and a one-page brief.
              </p>
            </div>
          </article>
        </div>

        {tab === "lineup" && compare && !booking && (
          <WithoutQlooView
            pitch={pitch}
            venueCity={venueCity}
            form={plainForm}
            headlinerLine={headlinerWhyLine}
            openerLine={openerReachLine}
          />
        )}

        {tab === "lineup" && booking && (
          <motion.div key="book" {...fadeUp}>
            <BookItView
              input={bookingInput}
              insights={insightsState}
              fileSlug={slugifyFilename(pitch.venueLabel)}
              onBack={() => setBooking(false)}
            />
          </motion.div>
        )}

        {tab === "food" && (
          <motion.div key="food" {...fadeUp}>
            <FoodDealsView
              state={insightsState}
              headlinerName={pitch.headliner.name}
              cityLabel={
                (insightsState.status === "ready" &&
                  insightsState.places.cityLabel) ||
                insightsInput?.cityLabel ||
                venueCity ||
                ""
              }
            />
          </motion.div>
        )}

        {tab === "marketing" && (
          <motion.div key="marketing" {...fadeUp}>
            <MarketingView
              state={insightsState}
              pitch={pitch}
              cityLabel={insightsInput?.cityLabel ?? venueCity ?? ""}
              street={street}
              leadWith={leadWith}
            />
          </motion.div>
        )}

        {tab === "data" && (
          <motion.article
            key="data"
            {...fadeUp}
            className={articleClass}
            data-tab-panel="data"
          >
            <LineupDataView pitch={pitch} analytics={analytics} />
          </motion.article>
        )}
      </motion.div>
    </div>
  );
}
