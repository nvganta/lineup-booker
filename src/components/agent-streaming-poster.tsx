"use client";

import { ArtistPhoto } from "@/components/artist-photo";
import dynamic from "next/dynamic";
import type { AgentStreamState } from "@/lib/agent/consume-agent-stream";
import type { PitchPayload } from "@/lib/agent/types";
import { venueDisplayName } from "@/lib/lineup/venue-display";
import { cn } from "@/lib/utils";

const LineupMap = dynamic(
  () => import("@/components/lineup-map").then((m) => m.LineupMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[180px] rounded-md border border-[#e8dfd6] bg-[#f3ece4] animate-pulse" />
    ),
  },
);

type Props = {
  state: AgentStreamState;
  venueConcept?: string;
  className?: string;
};

export function AgentStreamingPoster({
  state,
  venueConcept,
  className,
}: Props) {
  const venueTitle = venueConcept
    ? venueDisplayName(venueConcept)
    : state.pitch?.venueLabel ?? "Your room";
  const headliner =
    state.artists.find((a) => a.role === "headliner") ?? state.artists[0];
  const opener = state.artists.find((a) => a.role === "opener");
  const map = state.map;

  const partialPitch: PitchPayload | null = state.pitch
    ? state.pitch
    : headliner
      ? {
          venueLabel: venueTitle,
          address: "",
          moodLine: "Building your one-night poster…",
          headlinerWhy: "",
          openerWhy: "",
          headliner: {
            id: headliner.id,
            name: headliner.name,
            imageUrl: headliner.imageUrl,
          },
          opener: opener
            ? {
                id: opener.id,
                name: opener.name,
                imageUrl: opener.imageUrl,
              }
            : null,
          alternates: state.artists
            .filter((a) => a.role === "alternate")
            .map((a) => ({
              id: a.id,
              name: a.name,
              imageUrl: a.imageUrl,
            })),
          neighborhoods: map?.pins.map((p) => ({
            rank: p.rank,
            name: p.name,
            lat: p.lat,
            lon: p.lon,
          })) ?? [],
          evidenceFootnotes: {},
        }
      : null;

  if (!partialPitch) {
    return (
      <div
        className={cn(
          "max-w-xl mx-auto rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] p-6 min-h-[280px] flex flex-col items-center justify-center gap-3",
          className,
        )}
        aria-busy="true"
      >
        <p className="font-[family-name:var(--font-heading)] text-xl text-[#1a1614]">
          Scouting your room…
        </p>
        <p className="text-sm text-[#8a7f76] text-center max-w-xs">
          Photos and map pins will appear here as we lock picks.
        </p>
      </div>
    );
  }

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-xl overflow-hidden rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] text-[#1a1614] shadow-sm transition-opacity",
        className,
      )}
      aria-busy={!state.pitch}
    >
      <header className="px-5 pt-5 pb-3 border-b border-[#e0d5ca]">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#8c4a32]">
          One night
        </p>
        <p className="font-[family-name:var(--font-heading)] text-xl mt-1">
          {state.pitch?.venueLabel ?? venueTitle}
        </p>
        <p className="text-sm text-[#6b5c52] mt-2">{partialPitch.moodLine}</p>
      </header>

      {headliner?.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- streaming external artist URLs */}
          <img
            src={headliner.imageUrl}
            alt={headliner.name}
            className="w-full aspect-[5/3] object-cover bg-[#ebe3d9]"
          />
          <p className="px-5 pt-4 pb-3 border-b border-[#e8dfd6] font-[family-name:var(--font-heading)] text-3xl">
            {headliner.name}
          </p>
        </>
      ) : (
        <div className="h-[120px] bg-[#f0e8de] flex items-center justify-center px-5">
          <span className="font-[family-name:var(--font-heading)] text-3xl text-[#8c4a32]">
            {headliner?.name ?? "Headliner"}
          </span>
        </div>
      )}

      {opener && (
        <section className="px-5 py-4 flex gap-3 items-center border-b border-[#e8dfd6]">
          <ArtistPhoto
            name={opener.name}
            imageUrl={opener.imageUrl}
            rounded="full"
            className="h-12 w-12 text-base"
          />
          <p className="text-sm text-[#5c534d]">with {opener.name}</p>
        </section>
      )}

      {map && map.pins.length > 0 && (
        <section className="px-5 py-4 border-b border-[#e8dfd6]">
          <LineupMap
            lineup={{
              venue: { ...map.venue, city: "Venue" },
              neighborhoods: map.pins.map((p) => ({
                rank: p.rank,
                name: p.name,
                lat: p.lat,
                lon: p.lon,
              })),
            }}
            className="h-[180px]"
          />
        </section>
      )}

      {!state.pitch && (
        <p className="px-5 py-3 text-xs text-[#8a7f76] border-t border-[#e8dfd6]">
          Still scouting…
        </p>
      )}
    </article>
  );
}
