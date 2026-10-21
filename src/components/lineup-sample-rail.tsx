"use client";

import { ArtistPhoto } from "@/components/artist-photo";
import type { ExampleVenue } from "@/lib/example-venues";
import type { StoredLineup } from "@/lib/stored-lineups";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { INDICATOR } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { motion } from "motion/react";

type Props = {
  samples: ExampleVenue[];
  stored: StoredLineup[];
  activeRequest: LineupRequest;
  onSelectRequest: (request: LineupRequest) => void;
  onOpenStored: (item: StoredLineup) => void;
  onTogglePin: (id: string) => void;
  disabled?: boolean;
};

function isActive(a: LineupRequest, b: LineupRequest): boolean {
  return (
    a.location === b.location &&
    a.concept === b.concept &&
    a.regularsLove === b.regularsLove
  );
}

function RailButton({
  label,
  sub,
  active,
  disabled,
  onClick,
  leading,
  trailing,
  className,
}: {
  label: string;
  sub?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  // The trailing control (pin) sits beside the row button, not inside it:
  // a button inside a button is invalid HTML and breaks hydration.
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "relative w-full text-left rounded-md px-3 py-2.5 text-sm flex gap-2.5 items-start",
          trailing && "pr-9",
          "transition-[color,background-color,transform] duration-200 ease-out active:scale-[0.98] disabled:opacity-50",
          active ? "text-[#1a1614]" : "text-[#5c534d] hover:bg-[#faf7f2]",
          className,
        )}
      >
        {/* One shared highlight that slides between rows instead of blinking. */}
        {active && (
          <motion.span
            layoutId="rail-active"
            transition={INDICATOR}
            className="absolute inset-0 rounded-md bg-[#8c4a32]/12 border border-[#8c4a32]/25"
            aria-hidden
          />
        )}
        {leading && <span className="relative">{leading}</span>}
        <span className="relative min-w-0 flex-1">
          <span className="font-medium block leading-snug">{label}</span>
          {sub ? (
            <span className="text-[11px] text-[#8a7f76] line-clamp-2 mt-0.5 block">
              {sub}
            </span>
          ) : null}
        </span>
      </button>
      {trailing && <span className="absolute right-2 top-2.5">{trailing}</span>}
    </div>
  );
}

export function LineupSampleRailDesktop({
  samples,
  stored,
  activeRequest,
  onSelectRequest,
  onOpenStored,
  onTogglePin,
  disabled,
}: Props) {
  const pinned = stored.filter((s) => s.pinned);
  const rest = stored.filter((s) => !s.pinned);

  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 border-r border-[#e8dfd6] bg-[#f3ece4]/80 min-h-0 overflow-hidden">
      <div className="p-4 border-b border-[#e8dfd6] shrink-0">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#8c4a32]">
          Example rooms
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-1">
        {samples.map((ex) => (
          <RailButton
            key={ex.label}
            label={ex.label}
            sub={ex.request.regularsLove}
            active={isActive(ex.request, activeRequest)}
            disabled={disabled}
            onClick={() => onSelectRequest(ex.request)}
          />
        ))}
        {(pinned.length > 0 || rest.length > 0) && (
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#8a7f76] px-2 pt-3 pb-1">
            Your lineups
          </p>
        )}
        {[...pinned, ...rest].map((item) => (
          <RailButton
            key={item.id}
            label={item.venueLabel}
            sub={item.cityLabel}
            active={false}
            disabled={disabled}
            onClick={() => onOpenStored(item)}
            leading={
              <ArtistPhoto
                name={item.headlinerName}
                imageUrl={item.headlinerImageUrl}
                rounded="full"
                className="h-8 w-8 text-xs shrink-0 mt-0.5"
              />
            }
            trailing={
              <button
                type="button"
                className="shrink-0 p-1 text-[#8a7f76] hover:text-[#8c4a32]"
                aria-label={item.pinned ? "Unpin" : "Pin"}
                onClick={() => onTogglePin(item.id)}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    item.pinned && "fill-[#8c4a32] text-[#8c4a32]",
                  )}
                />
              </button>
            }
          />
        ))}
      </div>
    </aside>
  );
}

export function LineupSampleRailMobile({
  samples,
  stored,
  activeRequest,
  onSelectRequest,
  onOpenStored,
  disabled,
}: Omit<Props, "onTogglePin">) {
  const chips = [
    ...samples.map((ex) => ({
      key: `sample-${ex.label}`,
      label: ex.label,
      onClick: () => onSelectRequest(ex.request),
      active: isActive(ex.request, activeRequest),
    })),
    ...stored.slice(0, 4).map((item) => ({
      key: `stored-${item.id}`,
      label: item.venueLabel,
      onClick: () => onOpenStored(item),
      active: false,
    })),
  ];

  return (
    <div className="lg:hidden shrink-0 border-b border-[#e8dfd6] bg-[#f3ece4]/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#8c4a32] mb-2">
        Example rooms &amp; your lineups
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            disabled={disabled}
            onClick={chip.onClick}
            className={cn(
              "snap-start shrink-0 max-w-[14rem] rounded-full border px-3 py-1.5 text-xs text-left disabled:opacity-50",
              "transition-[color,background-color,border-color,transform] duration-200 ease-out active:scale-[0.97]",
              chip.active
                ? "border-[#8c4a32]/40 bg-[#8c4a32]/10 text-[#1a1614]"
                : "border-[#e0d5ca] bg-[#fcf9f5] text-[#1a1614]",
            )}
          >
            <span className="line-clamp-2">{chip.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
