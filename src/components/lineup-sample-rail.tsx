"use client";

import { ArtistPhoto } from "@/components/artist-photo";
import { EASE_OUT } from "@/lib/motion";
import type { StoredLineup } from "@/lib/stored-lineups";
import { cn } from "@/lib/utils";
import { ChevronDown, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

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
          "relative w-full text-left rounded-md px-2 py-2 pr-8 text-sm flex gap-2.5 items-start text-[#5c534d]",
          "transition-[color,background-color,transform] duration-200 ease-out hover:bg-[#f3ece4] hover:text-[#1a1614] active:scale-[0.98] disabled:opacity-50",
        )}
      >
        <ArtistPhoto
          name={item.headlinerName}
          imageUrl={item.headlinerImageUrl}
          rounded="full"
          className="h-7 w-7 text-xs shrink-0 mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="font-medium block leading-snug text-[#1a1614]">
            {item.headlinerName}
          </span>
          <span className="text-[11px] text-[#8a7f76] truncate mt-0.5 block">
            {item.venueLabel} · {item.cityLabel}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="absolute right-1.5 top-2 p-1 text-[#8a7f76] hover:text-[#8c4a32]"
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

/** Lineups scouted on this device, folded under the examples. Hidden until there is one. */
export function RecentLineups({
  stored,
  onOpenStored,
  onTogglePin,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  if (stored.length === 0) return null;
  const ordered = [
    ...stored.filter((s) => s.pinned),
    ...stored.filter((s) => !s.pinned),
  ];

  return (
    <div data-recent className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-[#8a7f76] hover:text-[#8c4a32] transition-colors cursor-pointer"
      >
        <span>
          Recent <span className="tabular-nums">({ordered.length})</span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="mt-2 -mx-2 max-h-64 overflow-y-auto overscroll-contain space-y-0.5">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
