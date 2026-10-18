"use client";

import { artistMonogram } from "@/lib/artist-monogram";
import type { LineupResult } from "@/lib/lineup/build-lineup";
import { proxiedImageUrl } from "@/lib/image-proxy";
import { upgradeQlooArtistImageUrl } from "@/lib/qloo-image-url";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Artist = LineupResult["headliner"];

const OOPS_MAX_NATURAL_WIDTH = 100;

export function HeadlinerHero({
  artist,
  noMatch,
  compact,
  whyLine,
}: {
  artist: Artist;
  noMatch: boolean;
  /** Poster card: split layout tuned for 1440×900 fit. */
  compact?: boolean;
  /** Headliner why line (poster / agent card). */
  whyLine?: string | null;
}) {
  const upgradedUrl = upgradeQlooArtistImageUrl(artist.imageUrl);
  const [useFallbackSize, setUseFallbackSize] = useState(false);
  const [imageOk, setImageOk] = useState(Boolean(artist.imageUrl));
  const photoSrc = proxiedImageUrl(
    useFallbackSize ? artist.imageUrl : upgradedUrl,
  );
  const showPhoto = Boolean(photoSrc) && imageOk;

  const handleImageIssue = () => {
    if (!useFallbackSize && upgradedUrl !== artist.imageUrl) {
      setUseFallbackSize(true);
      return;
    }
    setImageOk(false);
  };

  const initialsBlock = (
    <div
      className={cn(
        "flex items-center justify-center bg-[#f0e8de] text-[#8c4a32]",
        compact
          ? "aspect-[4/3] w-full lg:aspect-auto lg:size-[210px] lg:shrink-0"
          : "aspect-[4/3] w-full lg:aspect-auto lg:size-[210px]",
      )}
    >
      <span className="font-heading text-5xl leading-none">
        {artistMonogram(artist.name)}
      </span>
    </div>
  );

  const photoBlock = showPhoto ? (
    <div
      className={cn(
        "overflow-hidden bg-[#ebe3d9] border-[#e8dfd6]",
        compact
          ? "aspect-[4/3] w-full border-b lg:border-b-0 lg:border-r lg:aspect-auto lg:size-[210px] lg:shrink-0"
          : "aspect-[4/3] w-full border-b lg:border-b-0 lg:border-r lg:aspect-auto lg:size-[210px] lg:shrink-0",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoSrc}
        alt={artist.name}
        data-poster-image-key={artist.imageUrl ?? artist.id}
        className="size-full object-cover object-[50%_20%]"
        loading="lazy"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0 && img.naturalWidth < OOPS_MAX_NATURAL_WIDTH) {
            handleImageIssue();
          }
        }}
        onError={handleImageIssue}
      />
    </div>
  ) : (
    initialsBlock
  );

  const copyBlock = (
    <div
      className={cn(
        "min-w-0 flex flex-col justify-center bg-[#f7f2eb]",
        compact ? "px-5 py-3 lg:py-4 lg:px-5 flex-1" : "px-5 py-4 lg:flex-1",
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52] mb-1.5">
        Headliner
      </p>
      <h3
        className={cn(
          "font-heading leading-none text-[#1a1614]",
          compact
            ? "text-2xl lg:text-[2.05rem]"
            : "text-3xl md:text-[2.35rem]",
        )}
      >
        {artist.name}
      </h3>
      {whyLine?.trim() && (
        <p className="text-sm text-[#5c534d] mt-2 leading-snug line-clamp-2 lg:line-clamp-3">
          {whyLine.trim()}
        </p>
      )}
      {noMatch && artist.detail && (
        <p className="text-sm text-[#5c534d] mt-2 leading-snug">{artist.detail}</p>
      )}
    </div>
  );

  return (
    <section className="relative border-b border-[#e0d5ca] bg-[#f7f2eb]">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {photoBlock}
        {copyBlock}
      </div>
    </section>
  );
}
