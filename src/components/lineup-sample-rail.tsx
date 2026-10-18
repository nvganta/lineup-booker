"use client";

import { ArtistPhoto } from "@/components/artist-photo";
import type { ExampleVenue } from "@/lib/example-venues";
import type { StoredLineup } from "@/lib/stored-lineups";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

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
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors disabled:opacity-50 flex gap-2.5 items-start",
        active
          ? "bg-[#8c4a32]/12 text-[#1a1614] border border-[#8c4a32]/25"
          : "text-[#5c534d] hover:bg-[#faf7f2] border border-transparent",
        className,
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="font-medium block leading-snug">{label}</span>
        {sub ? (
          <span className="text-[11px] text-[#8a7f76] line-clamp-2 mt-0.5 block">
            {sub}
          </span>
        ) : null}
      </span>
      {trailing}
    </button>
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
          Samples
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
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(item.id);
                }}
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
        Samples & your lineups
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            disabled={disabled}
            onClick={chip.onClick}
            className={cn(
              "snap-start shrink-0 max-w-[14rem] rounded-full border px-3 py-1.5 text-xs text-left transition-colors disabled:opacity-50",
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
