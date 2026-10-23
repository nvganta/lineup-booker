"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PitchPayload } from "@/lib/agent/types";
import { ArtistPhoto } from "@/components/artist-photo";
import { Button } from "@/components/ui/button";
import { LineupDataView } from "@/components/lineup-data-view";
import { FoodDealsView } from "@/components/food-deals-view";
import { MarketingView } from "@/components/marketing-view";
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
import { drawLine } from "@/lib/lineup/draw-line";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";
import {
  posterRunWhyKey,
  whyCacheForPosterRun,
  whyLineForAct,
} from "@/lib/lineup/act-why-cache";
import { applyOpenerSwap } from "@/lib/lineup/opener-swap-state";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import { proxiedImageUrl } from "@/lib/image-proxy";
import { upgradeQlooArtistImageUrl } from "@/lib/qloo-image-url";
import { WithoutQlooView } from "@/components/without-qloo-view";
import { BookingEmailCard, NightBriefCard } from "@/components/book-it-view";
import { TrackPlayer } from "@/components/track-player";
import { QlooTrail } from "@/components/qloo-trail";
import { buildTrail } from "@/lib/qloo/trail";
import { ENTER } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Check, ExternalLink, MapPin } from "lucide-react";

type Props = {
  pitch: PitchPayload;
  venue?: { lat: number; lon: number };
  /** The owner's date line, if any. */
  when?: string;
  /** Reports Qloo's crowd read up to the summary column. */
  onAudience?: (line: string | null) => void;
  /** Reports which section is in view, for the links in the top bar. */
  onActiveSection?: (id: string) => void;
  className?: string;
  animateSettle?: boolean;
};

/** The page's sections, in order; the top bar shows them as links. */
export const PAGE_SECTIONS = [
  { id: "lineup", label: "Lineup" },
  { id: "sell", label: "What to sell" },
  { id: "promote", label: "Where to promote" },
  { id: "how", label: "How we got here" },
] as const;

const CARD =
  "rounded-md border border-[#e8dfd6] bg-[#f7f2eb] text-[#1a1614] shadow-[0_1px_0_rgba(26,22,20,0.06),0_20px_40px_-24px_rgba(26,22,20,0.18)]";

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

function SectionHead({
  id,
  title,
  sub,
  action,
}: {
  id: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="scroll-mt-16 flex items-end justify-between gap-4 mb-4"
    >
      <div>
        <h2 className="font-display text-[28px] leading-[1.1] text-[#1a1614]">
          {title}
        </h2>
        {sub && <p className="mt-1 text-[13px] text-[#6b5c52]">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function Chip({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-[4px] text-[11.5px] leading-none",
        accent
          ? "border-[#8c4a32]/30 bg-[#8c4a32]/8 text-[#8c4a32]"
          : "border-[#e0d5ca] bg-[#fcf9f5] text-[#3d3530]",
      )}
    >
      {children}
    </span>
  );
}

type ActCardProps = {
  slot: "Opener" | "Headliner";
  act: {
    id: string;
    name: string;
    imageUrl?: string;
    background?: PitchPayload["headliner"]["background"];
  };
  local: boolean;
  city?: string;
  tags: string[];
  why: string[];
  blurb?: string | null;
  onBook: () => void;
  bookOpen: boolean;
};

function ActCard({
  slot,
  act,
  local,
  city,
  tags,
  why,
  blurb,
  onBook,
  bookOpen,
}: ActCardProps) {
  const photo = proxiedImageUrl(upgradeQlooArtistImageUrl(act.imageUrl));
  const [photoOk, setPhotoOk] = useState(Boolean(photo));
  return (
    <article
      className={cn(CARD, "flex flex-col overflow-hidden")}
      data-act-card={slot.toLowerCase()}
    >
      <div className="relative aspect-[16/10] bg-[#ebe3d9]">
        {photo && photoOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={act.name}
            data-poster-image-key={act.imageUrl ?? act.id}
            className="absolute inset-0 h-full w-full object-cover object-[50%_25%]"
            loading="lazy"
            onError={() => setPhotoOk(false)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ArtistPhoto
              name={act.name}
              rounded="full"
              className="h-20 w-20 text-3xl"
            />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-[#1a1614]/85 px-2.5 py-1 text-[11px] font-medium text-[#faf7f2]">
          {slot}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-heading text-[19px] leading-tight">{act.name}</h3>
        {(local && city) || act.background?.line ? (
          <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-[#6b5c52]">
            <MapPin
              className="mt-[2px] size-3 shrink-0 text-[#8c4a32]"
              strokeWidth={2}
            />
            <span>
              {local && city ? `${city} act` : act.background?.line}
              {local && city && act.background?.line
                ? ` · ${act.background.line}`
                : ""}
            </span>
          </p>
        ) : null}
        {tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        )}
        {blurb && (
          <p className="mt-3 text-[13px] leading-[1.45] text-[#3d3530]">
            {blurb}
          </p>
        )}
        {why.length > 0 && (
          <div className="mt-3.5">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[#8c4a32] mb-1.5">
              Why they fit
            </p>
            <ul className="list-none space-y-1">
              {why.map((w) => (
                <li
                  key={w}
                  className="flex gap-2 text-[12.5px] leading-snug text-[#3d3530]"
                >
                  <Check
                    className="mt-[3px] size-3 shrink-0 text-[#8c4a32]"
                    strokeWidth={2.5}
                  />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 border-t border-[#e8dfd6] pt-3">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[#8c4a32] mb-1">
            Listen
          </p>
          <TrackPlayer artist={act.name} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <a
            href={`https://open.spotify.com/search/${encodeURIComponent(act.name)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#8a7f76] hover:text-[#8c4a32] transition-colors"
          >
            <ExternalLink className="size-3" strokeWidth={2} />
            More on Spotify
          </a>
          <Button
            type="button"
            onClick={onBook}
            aria-expanded={bookOpen}
            className={cn(
              "h-9 rounded-full px-4 text-[13px] transition-colors",
              bookOpen
                ? "bg-[#1a1614] text-[#faf7f2] hover:bg-[#2d2622]"
                : "bg-[#8c4a32] text-[#faf7f2] hover:bg-[#7a4030]",
            )}
          >
            {bookOpen ? "Close" : `Book ${act.name.split(" ")[0]}`}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function LineupPage({
  pitch: initialPitch,
  venue,
  when,
  onAudience,
  onActiveSection,
  className,
  animateSettle,
}: Props) {
  const [pitch, setPitch] = useState(initialPitch);
  // A different lineup for the same room keeps this page mounted (same key),
  // so take the new pitch rather than showing the old one.
  const [shownPitch, setShownPitch] = useState(initialPitch);
  if (initialPitch !== shownPitch) {
    setShownPitch(initialPitch);
    setPitch(initialPitch);
  }
  const [analyticsRev, setAnalyticsRev] = useState(0);
  // What is open under the cards: the night brief, or an email to one act.
  const [booking, setBooking] = useState<
    "night" | "headliner" | "opener" | null
  >(null);
  const rootRef = useRef<HTMLDivElement>(null);
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
  const headlinerDraw = drawLine(pitch.meta?.headlinerPopularity, capacity);
  const openerDraw = drawLine(pitch.meta?.openerPopularity, capacity);

  const handleSwap = useCallback(
    (swapNext: NonNullable<PitchPayload["openerSwapQueue"]>[number]) => {
      if (!pitch.opener) return;
      setAnalyticsRev((n) => n + 1);
      setPitch((p) => applyOpenerSwap({ pitch: p, swapNext }));
    },
    [pitch.opener],
  );

  const openerLocal =
    openerOriginMatchesForAct(pitch, pitch.opener?.id) ||
    analytics?.openerShowLocalBadge === true;
  const headlinerLocal = openerOriginMatchesForAct(pitch, pitch.headliner.id);

  const demographics =
    analytics?.demographics ?? pitch.crowdDemographics ?? null;
  const crowdLine =
    analytics?.crowdLine?.trim() || formatCrowdDisplay(demographics) || null;
  const topAge = crowdTopPositiveAgeRow(demographics);
  const genderLean = crowdGenderLean(demographics?.gender ?? null);
  useEffect(() => {
    onAudience?.(
      topAge || genderLean
        ? [
            topAge && `Ages ${topAge.label}`,
            genderLean && `leans ${genderLean}`,
          ]
            .filter(Boolean)
            .join(" · ")
        : null,
    );
  }, [onAudience, topAge, genderLean]);

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
            (id === pitch.opener?.id && openerLocal)),
      ),
    [pitch, openerLocal],
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
  // Every section is on one page now, so the place data loads with it.
  const insightsState = useVenueInsights(insightsInput, true);

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

  // The top bar lights the link for the section in view.
  const jump = useCallback((id: string) => {
    rootRef.current?.querySelector<HTMLElement>(`#${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !onActiveSection) return;
    const heads = PAGE_SECTIONS.map((s) =>
      root.querySelector<HTMLElement>(`#${s.id}`),
    ).filter((el): el is HTMLElement => Boolean(el));
    const scroller = root.closest<HTMLElement>("[data-result-feed]");
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (hit) onActiveSection(hit.target.id);
      },
      { root: scroller, rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [booking, onActiveSection]);

  const qlooCallCount =
    (pitch.qlooCalls?.length ?? 0) + (analytics?.qlooCalls?.length ?? 0);
  const otherOpeners = (pitch.openerSwapQueue ?? []).slice(0, 3);
  const alternates = pitch.alternates.slice(0, 4);
  const overlapLabel = analytics?.openerOverlap?.label?.replace(
    /,\s*\d(?:\.\d+)?\s*$/,
    "",
  );

  const headlinerWhy = [
    headlinerWhyLine,
    headlinerDraw && `${headlinerDraw.label}: ${headlinerDraw.line}`,
    headlinerLocal &&
      venueCity &&
      `From ${venueCity}, so the room is a home crowd`,
  ].filter((s): s is string => Boolean(s));
  const openerWhy = [
    pitch.openerWhy?.trim() || openerReachLine,
    overlapLabel &&
      analytics?.openerOverlap?.value != null &&
      `Fans overlap with ${pitch.headliner.name}'s: ${overlapLabel}`,
    openerDraw && `${openerDraw.label}: ${openerDraw.line}`,
  ].filter((s): s is string => Boolean(s));

  const actNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of [
      pitch.headliner,
      pitch.opener,
      ...pitch.alternates,
      ...(pitch.openerSwapQueue ?? []),
    ]) {
      if (a) m.set(a.id, a.name);
    }
    for (const a of analytics?.acts ?? []) m.set(a.id, a.name);
    return m;
  }, [pitch, analytics]);
  const trailNodes = useMemo(
    () =>
      buildTrail({
        pitch,
        analytics,
        cityLabel: venueCity,
        capacity,
        tagLabels: styleTags,
        crowdLine,
        neighborhoodNames: pitch.neighborhoods
          .slice(0, 5)
          .map((n) => stripCityFromNeighborhoodLabel(n.name, venueCity)),
      }),
    [pitch, analytics, venueCity, capacity, styleTags, crowdLine],
  );

  // The one line under the title says why these acts, not what the owner typed.
  const subtitle = [
    pitch.moodLine?.trim() ||
      `Acts that ${styleTags[0] ? `${styleTags[0]} fans` : "your crowd"} near ${venueCity ?? "you"} already go out for, sized to the room.`,
    when && `For ${when}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={cn("space-y-10 pt-5", className)}
      data-lineup-page
    >
      <motion.section
        initial={animateSettle ? { opacity: 0, y: 10 } : false}
        animate={animateSettle ? { opacity: 1, y: 0 } : undefined}
        transition={{ ...ENTER, duration: 0.45 }}
      >
        <SectionHead
          id="lineup"
          title="Here's your lineup."
          sub={subtitle}
          action={
            <div className="flex items-center gap-2 shrink-0">
              {qlooCallCount > 0 && (
                <button
                  type="button"
                  onClick={() => jump("how")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-3 py-1.5 text-[12px] leading-none text-[#5c534d] hover:text-[#8c4a32] hover:border-[#8c4a32]/40 transition-colors cursor-pointer"
                  data-qloo-count
                >
                  <span className="size-1.5 rounded-full bg-[#8c4a32]" aria-hidden />
                  {qlooCallCount} Qloo lookups
                </button>
              )}
              <Button
                type="button"
                onClick={() =>
                  setBooking((b) => (b === "night" ? null : "night"))
                }
                aria-expanded={booking === "night"}
                className="h-9 rounded-full bg-[#1a1614] px-5 text-[13px] text-[#faf7f2] shadow-[0_1px_2px_rgba(26,22,20,0.25)] hover:bg-[#2d2622] transition-colors"
                data-book-it
              >
                {booking === "night" ? "Close" : "Book it"}
              </Button>
            </div>
          }
        />

        {/* The night brief slides open under the title and stays there. */}
        <AnimatePresence initial={false}>
          {booking === "night" && (
            <motion.div
              key="night"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={ENTER}
              className="overflow-hidden"
            >
              <NightBriefCard
                className="mt-4"
                input={bookingInput}
                insights={insightsState}
                fileSlug={slugifyFilename(pitch.venueLabel)}
                when={when}
                onEmail={(act) => setBooking(act)}
                onClose={() => setBooking(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {
          <>
            <div className="mt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                <AnimatePresence mode="popLayout" initial={false}>
                  {pitch.opener && (
                    <motion.div
                      key={pitch.opener.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={ENTER}
                      className="flex"
                    >
                      <ActCard
                        slot="Opener"
                        act={pitch.opener}
                        local={openerLocal}
                        city={venueCity}
                        tags={styleTags}
                        why={openerWhy}
                        onBook={() =>
                          setBooking((b) => (b === "opener" ? null : "opener"))
                        }
                        bookOpen={booking === "opener"}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex">
                  <ActCard
                    slot="Headliner"
                    act={pitch.headliner}
                    local={headlinerLocal}
                    city={venueCity}
                    tags={styleTags}
                    why={headlinerWhy}
                    onBook={() =>
                      setBooking((b) =>
                        b === "headliner" ? null : "headliner",
                      )
                    }
                    bookOpen={booking === "headliner"}
                  />
                </div>
              </div>
              {/* The email to one act slides open under the cards. */}
              <AnimatePresence initial={false}>
                {(booking === "headliner" ||
                  (booking === "opener" && pitch.opener)) && (
                  <motion.div
                    key={booking}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={ENTER}
                    className="overflow-hidden"
                  >
                    <BookingEmailCard
                      className="mt-4"
                      actLabel={
                        booking === "opener"
                          ? pitch.opener!.name
                          : pitch.headliner.name
                      }
                      input={
                        booking === "opener"
                          ? {
                              ...bookingInput,
                              headliner: pitch.opener!.name,
                              opener: null,
                            }
                          : bookingInput
                      }
                      onClose={() => setBooking(null)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              {otherOpeners.length > 0 && pitch.opener && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#6b5c52]">
                  <span>Or open with</span>
                  {otherOpeners.map((o) => (
                    <button
                      key={o.id}
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
                  ))}
                </div>
              )}
            </div>

            {alternates.length > 0 && (
              <div className="mt-8">
                <SectionHead
                  id="more"
                  title="More options"
                  sub="Other acts your crowd might love."
                />
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 list-none">
                  {alternates.map((a) => {
                    const why = whyFor(a.id);
                    return (
                      <li
                        key={a.id}
                        className={cn(CARD, "flex gap-3 p-3 items-start")}
                      >
                        <ArtistPhoto
                          name={a.name}
                          imageUrl={a.imageUrl}
                          rounded="md"
                          className="h-14 w-14 text-base shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium leading-tight line-clamp-2">
                            {a.name}
                          </p>
                          {why && (
                            <p className="mt-1 text-[11.5px] leading-snug text-[#6b5c52] line-clamp-3">
                              {why}
                            </p>
                          )}
                          <TrackPlayer
                            artist={a.name}
                            compact
                            className="mt-2"
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        }
      </motion.section>

      <section>
        <SectionHead
          id="sell"
          title="What to put on special"
          sub={`Where ${pitch.headliner.name} fans eat and drink, against ${venueCity ?? "the city"}.`}
        />
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
      </section>

      <section>
        <SectionHead
          id="promote"
          title="Where to promote"
          sub={`Where ${pitch.headliner.name} fans live, where to leave flyers, and a poster to post.`}
        />
        <MarketingView
          state={insightsState}
          pitch={pitch}
          venue={venue}
          cityLabel={insightsInput?.cityLabel ?? venueCity ?? ""}
          street={street}
          leadWith={leadWith}
          defaultWhen={when}
        />
      </section>

      <section>
        <SectionHead
          id="how"
          title="How we got here"
          sub="What a plain model guessed, what Qloo found, and every call behind it."
        />
        <div className="space-y-6">
          <WithoutQlooView
            pitch={pitch}
            venueCity={venueCity}
            form={plainForm}
            headlinerLine={headlinerWhyLine}
            openerLine={openerReachLine}
          />
          <div>
            <h3 className="font-display text-[22px] leading-tight text-[#1a1614]">
              The trail
            </h3>
            <p className="mt-0.5 mb-3 text-[13px] text-[#6b5c52]">
              Room to lineup, stop by stop. Each stop holds the Qloo requests
              behind it.
            </p>
            <QlooTrail nodes={trailNodes} names={actNames} />
          </div>
          <details className="group">
            <summary className="cursor-pointer list-none text-[13px] text-[#6b5c52] hover:text-[#8c4a32] transition-colors">
              <span className="group-open:hidden">Show the charts</span>
              <span className="hidden group-open:inline">Hide the charts</span>
              <span className="ml-1.5 text-[11px] text-[#8a7f76]">
                reach, opener overlap, venue tags, crowd skew
              </span>
            </summary>
            <article className={cn(CARD, "mt-3")} data-tab-panel="data">
              <LineupDataView pitch={pitch} analytics={analytics} />
            </article>
          </details>
        </div>
      </section>
    </div>
  );
}
