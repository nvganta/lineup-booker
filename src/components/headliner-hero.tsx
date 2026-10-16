"use client";

import { artistMonogram } from "@/lib/artist-monogram";
import type { LineupResult } from "@/lib/lineup/build-lineup";
import { useState } from "react";

type Artist = LineupResult["headliner"];

export function HeadlinerHero({
  artist,
  noMatch,
}: {
  artist: Artist;
  noMatch: boolean;
}) {
  const [imageOk, setImageOk] = useState(Boolean(artist.imageUrl));
  const showPhoto = Boolean(artist.imageUrl) && imageOk;

  return (
    <section className="relative border-b border-[#e0d5ca]">
      {showPhoto ? (
        <>
          <p className="absolute left-5 top-3 z-10 rounded-full bg-[#1a1614]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[#faf7f2]">
            Headliner
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artist.imageUrl}
            alt={artist.name}
            className="w-full aspect-[5/3] md:aspect-[16/9] object-cover bg-[#ebe3d9]"
            loading="lazy"
            onError={() => setImageOk(false)}
          />
        </>
      ) : (
        <div className="h-[120px] bg-[#f0e8de] flex flex-col items-center justify-center gap-1 px-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
            Headliner
          </p>
          <span className="font-heading text-5xl md:text-6xl text-[#8c4a32] leading-none">
            {artistMonogram(artist.name)}
          </span>
        </div>
      )}
      <div className="bg-[#f7f2eb] px-5 py-4">
        <h3 className="font-heading text-3xl md:text-[2.35rem] leading-none text-[#1a1614]">
          {artist.name}
        </h3>
        {noMatch && artist.detail && (
          <p className="text-sm text-[#5c534d] mt-2 leading-snug">
            {artist.detail}
          </p>
        )}
      </div>
    </section>
  );
}
