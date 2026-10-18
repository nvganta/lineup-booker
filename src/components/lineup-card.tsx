"use client";

import dynamic from "next/dynamic";
import type { LineupResult } from "@/lib/lineup/build-lineup";
import { ArtistPhoto } from "@/components/artist-photo";
import { HeadlinerHero } from "@/components/headliner-hero";
import { Badge } from "@/components/ui/badge";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import { cn } from "@/lib/utils";

const LineupMap = dynamic(
  () => import("@/components/lineup-map").then((m) => m.LineupMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] rounded-md border border-[#e8dfd6] bg-[#f3ece4] animate-pulse" />
    ),
  },
);

type Props = {
  lineup: LineupResult;
  className?: string;
  preview?: boolean;
  /** Full-width feed column (Layout B result pane). */
  wideFeed?: boolean;
};

export function LineupCard({ lineup, className, preview, wideFeed }: Props) {
  const noMatch = lineup.headliner.id === "no-headliner-match";

  return (
    <article
      className={cn(
        "relative mx-auto w-full max-w-xl overflow-hidden rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] text-[#1a1614]",
        "shadow-[0_1px_0_rgba(26,22,20,0.06),0_20px_40px_-24px_rgba(26,22,20,0.22)]",
        preview && "opacity-[0.92] scale-[0.98] origin-top",
        className,
      )}
    >
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-[#e0d5ca]">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8c4a32]">
            {lineup.eventLabel}
          </p>
          <p className="font-heading text-lg md:text-xl leading-tight mt-1 truncate">
            {lineup.venueLabel}
          </p>
        </div>
        {preview && (
          <Badge
            variant="outline"
            className="shrink-0 rounded-full border-[#d4c4b5] text-[#6b5c52] text-[10px] uppercase tracking-wider bg-[#fcf9f5]"
          >
            Saved run
          </Badge>
        )}
      </div>

      <HeadlinerHero artist={lineup.headliner} noMatch={noMatch} />

      <div className="p-5 space-y-6">
        {lineup.opener ? (
          <section className="flex gap-3 items-center">
            <ArtistPhoto
              name={lineup.opener.name}
              imageUrl={lineup.opener.imageUrl}
              rounded="full"
              className="h-14 w-14 text-lg"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
                  Opener
                </p>
              </div>
              <p className="font-heading text-xl leading-tight mt-0.5">
                {lineup.opener.name}
              </p>
            </div>
          </section>
        ) : (
          !noMatch && (
            <section>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
                Opener
              </p>
              <p className="font-heading text-xl text-[#5c534d] mt-1">
                No local opener
              </p>
            </section>
          )
        )}

        {lineup.alternates.length > 0 && (
          <section className="border-t border-[#e8dfd6] pt-5 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
              Also strong
            </p>
            <ul
              className={cn(
                "flex flex-wrap list-none",
                wideFeed ? "gap-5 lg:gap-6" : "gap-4",
              )}
            >
              {lineup.alternates.map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    "flex flex-col items-center gap-1.5",
                    wideFeed ? "w-[5.25rem]" : "w-[4.5rem]",
                  )}
                >
                  <ArtistPhoto
                    name={a.name}
                    imageUrl={a.imageUrl}
                    rounded="full"
                    className="h-12 w-12 text-sm"
                  />
                  <span className="text-[11px] text-center leading-tight text-[#1a1614] line-clamp-2">
                    {a.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {lineup.neighborhoods.length > 0 && (
          <section className="border-t border-[#e8dfd6] pt-5 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
              Promote nearby
            </p>
            {lineup.venue && (
              <LineupMap
                lineup={lineup}
                className={
                  wideFeed
                    ? "h-[220px] md:h-[280px] xl:h-[320px]"
                    : "h-[200px] md:h-[220px]"
                }
              />
            )}
            <ol
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 list-none text-sm",
                wideFeed && "lg:grid-cols-3",
              )}
            >
              {lineup.neighborhoods.map((n) => (
                <li key={n.rank} className="flex gap-2 items-baseline">
                  <span className="text-[#8c4a32] font-medium tabular-nums">
                    {n.rank}.
                  </span>
                  <span className="font-heading">
                    {stripCityFromNeighborhoodLabel(
                      n.name,
                      lineup.venue?.city,
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

    </article>
  );
}
