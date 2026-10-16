"use client";

import dynamic from "next/dynamic";
import { ArtistPhoto } from "@/components/artist-photo";
import { HeadlinerHero } from "@/components/headliner-hero";
import type { PitchPayload } from "@/lib/agent/types";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import { cn } from "@/lib/utils";

const LineupMap = dynamic(
  () => import("@/components/lineup-map").then((m) => m.LineupMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] bg-[#f3ece4] animate-pulse rounded-md" />
    ),
  },
);

type Props = {
  pitch: PitchPayload;
  venue?: { lat: number; lon: number };
  className?: string;
};

function cityHintFromAddress(address: string): string | undefined {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return undefined;
  return parts[parts.length - 2];
}

export function AgentResultCard({ pitch, venue, className }: Props) {
  const venueCity = cityHintFromAddress(pitch.address);
  const lineupLike = {
    venue: venue ? { ...venue, city: "Venue" } : undefined,
    neighborhoods: pitch.neighborhoods,
  };

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-xl overflow-hidden rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] text-[#1a1614]",
        "shadow-[0_1px_0_rgba(26,22,20,0.06),0_20px_40px_-24px_rgba(26,22,20,0.22)]",
        className,
      )}
    >
      <header className="px-5 pt-5 pb-3 border-b border-[#e0d5ca]">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#8c4a32]">
          One night
        </p>
        <p className="font-heading text-xl mt-1">{pitch.venueLabel}</p>
        <p className="text-sm text-[#6b5c52] mt-1">{pitch.address}</p>
        <p className="font-heading text-lg text-[#8c4a32] mt-2">
          {pitch.moodLine}
        </p>
      </header>

      <HeadlinerHero
        artist={{
          id: pitch.headliner.id,
          name: pitch.headliner.name,
          tierLabel: "Headliner",
          imageUrl: pitch.headliner.imageUrl,
        }}
        noMatch={false}
      />
      {/* Why + background share one block so the divider sits under both. */}
      <div className="px-5 py-3 border-b border-[#e8dfd6] space-y-1.5">
        <p className="text-sm text-[#5c534d]">{pitch.headlinerWhy}</p>
        {pitch.headliner.background?.line && (
          <p className="text-xs leading-relaxed text-[#8a7f76]">
            {pitch.headliner.background.line}{" "}
            <a
              href={pitch.headliner.background.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8c4a32] underline-offset-2 hover:underline"
            >
              {pitch.headliner.background.sourceName}
            </a>
          </p>
        )}
      </div>

      {pitch.opener && (
        <section className="px-5 py-4 flex gap-3 items-center border-b border-[#e8dfd6]">
          <ArtistPhoto
            name={pitch.opener.name}
            imageUrl={pitch.opener.imageUrl}
            rounded="full"
            className="h-14 w-14 text-lg"
          />
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
              with {pitch.opener.name}
            </p>
            <p className="text-sm text-[#5c534d] mt-1">{pitch.openerWhy}</p>
            {pitch.opener.background?.line && (
              <p className="text-xs text-[#8a7f76] mt-1">
                {pitch.opener.background.line}{" "}
                <a
                  href={pitch.opener.background.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#8c4a32] underline-offset-2 hover:underline"
                >
                  {pitch.opener.background.sourceName}
                </a>
              </p>
            )}
          </div>
        </section>
      )}

      {pitch.neighborhoods.length > 0 && (
        <section className="px-5 py-5 border-b border-[#e8dfd6] space-y-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
            Put posters up where the heat is
          </p>
          {lineupLike.venue && (
            <LineupMap
              lineup={{
                venue: lineupLike.venue,
                neighborhoods: pitch.neighborhoods,
              }}
              className="h-[200px]"
            />
          )}
          <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1 list-none text-sm">
            {pitch.neighborhoods.map((n) => (
              <li key={n.rank} className="flex gap-2">
                <span className="text-[#8c4a32]">{n.rank}.</span>
                <span className="font-heading">
                  {stripCityFromNeighborhoodLabel(n.name, venueCity)}
                </span>
                {n.km != null && (
                  <span className="text-[#8a7f76] text-xs">
                    {n.km.toFixed(1)} km
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {pitch.crowdLine?.trim() && (
        <p className="px-5 py-4 text-sm text-[#5c534d] border-b border-[#e8dfd6]">
          {pitch.crowdLine}
        </p>
      )}

      {pitch.alternates.length > 0 && (
        <section className="px-5 py-4 border-b border-[#e8dfd6]">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52] mb-3">
            Bench
          </p>
          <ul className="flex flex-wrap gap-4 list-none">
            {pitch.alternates.map((a) => (
              <li key={a.id} className="flex flex-col items-center gap-1 w-16">
                <ArtistPhoto
                  name={a.name}
                  imageUrl={a.imageUrl}
                  rounded="full"
                  className="h-11 w-11 text-xs"
                />
                <span className="text-[11px] text-center leading-tight">
                  {a.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="px-5 py-4 text-[10px] text-[#8a7f76] space-y-2">
        <p>Taste-graph signals, not ticket forecasts.</p>
        {pitch.widenRoomNote && (
          <p className="text-[#6b5c52]">{pitch.widenRoomNote}</p>
        )}
      </footer>
    </article>
  );
}
