"use client";

import type { VenueInsightsState } from "@/hooks/use-venue-insights";
import type { PitchPayload } from "@/lib/agent/types";
import { ShowPoster } from "@/components/show-poster";
import { Button } from "@/components/ui/button";
import { slugifyFilename } from "@/lib/copy/slugify";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import { venueDisplayName } from "@/lib/lineup/venue-display";
import { withPosterExportImageCacheBust } from "@/lib/poster-export-images";
import { cn } from "@/lib/utils";
import {
  DraftedBadge,
  Muted,
  POSTER_ARTICLE_CLASS,
  SectionLabel,
  SourceNote,
  TabLoading,
  TabSection,
} from "@/components/venue-tab-parts";
import { toPng } from "html-to-image";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

const LineupMap = dynamic(
  () => import("@/components/lineup-map").then((m) => m.LineupMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] rounded-md border border-[#e8dfd6] bg-[#f3ece4] animate-pulse" />
    ),
  },
);

type Props = {
  state: VenueInsightsState;
  pitch: PitchPayload;
  venue?: { lat: number; lon: number };
  cityLabel: string;
  street: string;
  leadWith: string[];
  /** The owner's date line, if they gave one; seeds the poster. */
  defaultWhen?: string;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard blocked; nothing to do */
        }
      }}
      className="shrink-0 rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-2.5 py-1 text-[11px] text-[#6b5c52] hover:text-[#8c4a32] hover:border-[#8c4a32]/40 transition-colors cursor-pointer"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function MarketingView({ state, pitch, venue, cityLabel, street, leadWith, defaultWhen }: Props) {
  const [when, setWhen] = useState(defaultWhen ?? "");
  const posterRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    const node = posterRef.current;
    if (!node) return;
    try {
      let dataUrl = "";
      await withPosterExportImageCacheBust(node, async () => {
        dataUrl = await toPng(node, {
          cacheBust: true,
          includeQueryParams: true,
          pixelRatio: 3,
          fetchRequestInit: { cache: "no-store" },
        });
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${slugifyFilename(pitch.venueLabel)}-poster.png`;
      a.click();
    } catch {
      /* export failed; the poster stays on screen */
    }
  }, [pitch.venueLabel]);

  if (state.status === "idle" || state.status === "loading") {
    return <TabLoading label="Reading Qloo place data…" />;
  }
  const hoods = pitch.neighborhoods.slice(0, 5);
  const places = state.status === "ready" ? state.places : null;
  const copyState = state.status === "ready" ? state.copy : null;
  const copy = copyState?.status === "ready" ? copyState.copy : null;
  const venueStreet = street.trim().toLowerCase();
  const nearAll = (places?.near.spots ?? []).filter(
    (s) => !venueStreet || s.street.trim().toLowerCase() !== venueStreet,
  );
  const spots = [
    ...nearAll.filter((s) => s.eatDrink),
    ...nearAll.filter((s) => !s.eatDrink),
  ].slice(0, 6);

  return (
    <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")} data-tab-panel="marketing">
      <TabSection>
        <SectionLabel>Where the fans live</SectionLabel>
        {hoods.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 items-stretch">
            {venue ? (
              <LineupMap
                lineup={{ venue: { ...venue, city: "Venue" }, neighborhoods: hoods }}
                className="h-[260px] relative z-0"
              />
            ) : (
              <div className="h-[260px] rounded-md border border-[#e8dfd6] bg-[#f3ece4] flex items-center justify-center text-[12px] text-[#8a7f76]">
                No map for this run.
              </div>
            )}
            <ol className="list-none flex flex-col justify-center gap-1.5" data-hood-row>
              {hoods.map((n) => (
                <li key={n.rank} className="flex items-baseline gap-2.5 text-[14px] leading-tight">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#8c4a32] text-[11px] font-semibold text-[#faf7f2]">
                    {n.rank}
                  </span>
                  <span className="min-w-0 truncate">
                    {stripCityFromNeighborhoodLabel(n.name, cityLabel)}
                  </span>
                  {n.km != null && (
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[#8a7f76]">
                      {n.km < 1 ? `${Math.round(n.km * 1000)} m` : `${n.km.toFixed(1)} km`}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <Muted>No neighbourhood data for this run.</Muted>
        )}
        <SourceNote className="mt-2.5">
          Ranked by Qloo&apos;s fan heatmap for {pitch.headliner.name}, within 5 km. Put posters here first.
        </SourceNote>
      </TabSection>

      <TabSection>
        <SectionLabel>Flyer spots near you</SectionLabel>
        {state.status === "error" ? (
          <Muted>Qloo place data didn&apos;t load.</Muted>
        ) : spots.length >= 3 ? (
          <ul className="list-none grid grid-cols-1 sm:grid-cols-3 gap-x-[18px]">
            {spots.map((s) => (
              <li key={s.id} className="py-[5px] border-t border-[#e8dfd6]">
                <p className="font-heading text-[15px] leading-[1.15]">{s.name}</p>
                <p className="text-[12px] leading-[1.35] text-[#5c534d]">
                  {[s.street, s.kinds.slice(0, 2).join(", ").toLowerCase()].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Muted>Too few fan spots near the venue to suggest.</Muted>
        )}
        {spots.length >= 3 && (
          <SourceNote className="mt-2">
            Places {pitch.headliner.name} fans go, within 1.5 km of {street || "the venue"}.
          </SourceNote>
        )}
      </TabSection>

      <TabSection last>
        <SectionLabel>
          Poster and posts
          {copy && <DraftedBadge source={copy.source} />}
        </SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5 items-start">
          <div>
            <div className="rounded-md overflow-hidden border border-[#e0d5ca] [container-type:inline-size]">
              <ShowPoster
                ref={posterRef}
                headliner={pitch.headliner}
                opener={pitch.opener?.name ?? null}
                venueLabel={venueDisplayName(pitch.venueLabel)}
                address={street || pitch.address}
                when={when}
              />
            </div>
            <input
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              placeholder="Date and time, e.g. Fri 14 Nov · 8 PM"
              aria-label="Date and time for the poster"
              className="mt-2.5 h-9 w-full rounded-md border border-[#e8dfd6] bg-[#fcf9f5] px-3 text-[13px] outline-none placeholder:text-[#9a8f85] focus:border-[#8c4a32]/50"
              data-poster-when
            />
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full rounded-full border-[#e0d5ca] text-sm"
              onClick={handleDownload}
              data-download-poster
            >
              Download poster
            </Button>
          </div>

          <div className="min-w-0">
            {leadWith.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] text-[#8a7f76] mb-1.5">Lead with</p>
                <div className="flex flex-wrap gap-1.5">
                  {leadWith.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-[#e0d5ca] bg-[#fbf8f3] px-2.5 py-[5px] text-[12px] leading-none"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-[#8a7f76] mb-1.5">Posts</p>
            {copy ? (
              <ul className="list-none flex flex-col gap-2">
                {copy.captions.slice(0, 3).map((c) => (
                  <li
                    key={c}
                    className="flex items-start justify-between gap-3 rounded-[4px] border border-[#e8dfd6] bg-[#fbf8f3] px-3 py-2 text-[13px] leading-[1.45]"
                  >
                    <span>{c}</span>
                    <CopyButton text={c} />
                  </li>
                ))}
              </ul>
            ) : copyState?.status === "loading" ? (
              <p className="text-[13px] text-[#8a7f76] italic" aria-busy="true" data-drafting>
                Drafting posts…
              </p>
            ) : (
              <Muted>Drafting didn&apos;t finish, so no posts are shown.</Muted>
            )}
            <SourceNote className="mt-3">
              Fill in the date, download the poster, paste a post. Check the words before they go out.
            </SourceNote>
          </div>
        </div>
      </TabSection>
    </article>
  );
}
