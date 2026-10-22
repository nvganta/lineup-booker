"use client";

import { proxiedImageUrl } from "@/lib/image-proxy";
import { upgradeQlooArtistImageUrl } from "@/lib/qloo-image-url";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export type ShowPosterProps = {
  headliner: { name: string; imageUrl?: string };
  opener: string | null;
  venueLabel: string;
  address: string;
  /** "Fri 14 Nov · 8 PM", or empty for the placeholder. */
  when: string;
  className?: string;
};

/** A 4:5 poster the owner can post as is: photo, headliner, opener, room, date. */
export const ShowPoster = forwardRef<HTMLDivElement, ShowPosterProps>(
  function ShowPoster(
    { headliner, opener, venueLabel, address, when, className },
    ref,
  ) {
    const photo = proxiedImageUrl(upgradeQlooArtistImageUrl(headliner.imageUrl));
    return (
      <div
        ref={ref}
        data-show-poster
        className={cn(
          "relative aspect-[4/5] w-full overflow-hidden bg-[#1a1614] text-[#faf7f2]",
          className,
        )}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            data-poster-image-key={headliner.imageUrl ?? headliner.name}
            className="absolute inset-0 h-full w-full object-cover object-[50%_20%]"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(26,22,20,0.15) 0%, rgba(26,22,20,0.1) 35%, rgba(26,22,20,0.82) 68%, rgba(26,22,20,0.96) 100%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-[6%] text-[2.6cqw]">
          <p className="uppercase tracking-[0.2em] opacity-90">{venueLabel}</p>
          <p className="uppercase tracking-[0.2em] opacity-90">Live</p>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-[7%]">
          <p
            className="font-display leading-[0.95] text-balance"
            style={{ fontSize: headliner.name.length > 16 ? "9.5cqw" : "12cqw" }}
          >
            {headliner.name}
          </p>
          {opener && (
            <p className="mt-[3%] text-[3.4cqw] opacity-90">with {opener}</p>
          )}
          <div className="mt-[6%] flex items-end justify-between gap-4 border-t border-[#faf7f2]/30 pt-[4%] text-[2.7cqw]">
            <p className={cn("font-medium", !when && "opacity-60")}>
              {when || "Date and time"}
            </p>
            <p className="text-right opacity-80 max-w-[55%]">{address}</p>
          </div>
        </div>
      </div>
    );
  },
);
