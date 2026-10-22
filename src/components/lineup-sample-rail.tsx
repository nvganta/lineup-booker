"use client";

import { ArtistPhoto } from "@/components/artist-photo";
import type { StoredLineup } from "@/lib/stored-lineups";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

type Props = {
  stored: StoredLineup[];
  onOpenStored: (item: StoredLineup) => void;
  onTogglePin: (id: string) => void;
  disabled?: boolean;
};

function RecentRow({
  item,
  disabled,
  onOpen,
  onTogglePin,
}: {
  item: StoredLineup;
  disabled?: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  // The pin sits beside the row button, not inside it:
  // a button inside a button is invalid HTML and breaks hydration.
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className={cn(
          "relative w-full text-left rounded-md px-3 py-2.5 pr-9 text-sm flex gap-2.5 items-start text-[#5c534d]",
          "transition-[color,background-color,transform] duration-200 ease-out hover:bg-[#faf7f2] hover:text-[#1a1614] active:scale-[0.98] disabled:opacity-50",
        )}
      >
        <ArtistPhoto
          name={item.headlinerName}
          imageUrl={item.headlinerImageUrl}
          rounded="full"
          className="h-8 w-8 text-xs shrink-0 mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="font-medium block leading-snug text-[#1a1614]">
            {item.headlinerName}
          </span>
          <span className="text-[11px] text-[#8a7f76] line-clamp-2 mt-0.5 block">
            {item.venueLabel} · {item.cityLabel}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="absolute right-2 top-2.5 p-1 text-[#8a7f76] hover:text-[#8c4a32]"
        aria-label={item.pinned ? "Unpin" : "Pin"}
        onClick={onTogglePin}
      >
        <Star
          className={cn(
            "h-3.5 w-3.5",
            item.pinned && "fill-[#8c4a32] text-[#8c4a32]",
          )}
        />
      </button>
    </div>
  );
}

/** Recent lineups, like a chat app's history. Hidden until there is one. */
export function RecentRailDesktop({
  stored,
  onOpenStored,
  onTogglePin,
  disabled,
}: Props) {
  if (stored.length === 0) return null;
  const ordered = [
    ...stored.filter((s) => s.pinned),
    ...stored.filter((s) => !s.pinned),
  ];

  return (
    <aside
      data-recent-rail
      className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 border-r border-[#e8dfd6] bg-[#f3ece4]/80 min-h-0 overflow-hidden"
    >
      <div className="p-4 border-b border-[#e8dfd6] shrink-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8c4a32]">
          Recent
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-1">
        {ordered.map((item) => (
          <RecentRow
            key={item.id}
            item={item}
            disabled={disabled}
            onOpen={() => onOpenStored(item)}
            onTogglePin={() => onTogglePin(item.id)}
          />
        ))}
      </div>
    </aside>
  );
}

export function RecentRailMobile({
  stored,
  onOpenStored,
  disabled,
}: Omit<Props, "onTogglePin">) {
  if (stored.length === 0) return null;

  return (
    <div className="lg:hidden shrink-0 border-b border-[#e8dfd6] bg-[#f3ece4]/60 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8c4a32] mb-2">
        Recent
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {stored.slice(0, 6).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onOpenStored(item)}
            className={cn(
              "snap-start shrink-0 max-w-[14rem] rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-3 py-1.5 text-xs text-left text-[#1a1614] disabled:opacity-50",
              "transition-[color,background-color,border-color,transform] duration-200 ease-out active:scale-[0.97]",
            )}
          >
            <span className="line-clamp-1">
              {item.headlinerName} · {item.venueLabel}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
