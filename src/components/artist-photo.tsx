"use client";

import { artistMonogram } from "@/lib/artist-monogram";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Props = {
  name: string;
  imageUrl?: string;
  className?: string;
  rounded?: "full" | "md" | "none";
};

export function ArtistPhoto({
  name,
  imageUrl,
  className,
  rounded = "md",
}: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = imageUrl && !failed;
  const radius =
    rounded === "full"
      ? "rounded-full"
      : rounded === "none"
        ? "rounded-none"
        : "rounded-md";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#ebe3d9] text-[#8c4a32] shrink-0",
        radius,
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center font-heading text-[0.45em] tracking-tight select-none"
          aria-hidden
        >
          {artistMonogram(name)}
        </span>
      )}
    </div>
  );
}
