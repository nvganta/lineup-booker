"use client";

import type { ExampleVenue } from "@/lib/example-venues";
import type { RecentLineup } from "@/lib/recent-lineups";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { cn } from "@/lib/utils";

type Props = {
  samples: ExampleVenue[];
  recent: RecentLineup[];
  activeRequest: LineupRequest;
  onSelect: (request: LineupRequest) => void;
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
  className,
}: {
  label: string;
  sub?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors disabled:opacity-50",
        active
          ? "bg-[#8c4a32]/12 text-[#1a1614] border border-[#8c4a32]/25"
          : "text-[#5c534d] hover:bg-[#faf7f2] border border-transparent",
        className,
      )}
    >
      <span className="font-medium block leading-snug">{label}</span>
      {sub ? (
        <span className="text-[11px] text-[#8a7f76] line-clamp-2 mt-0.5">
          {sub}
        </span>
      ) : null}
    </button>
  );
}

export function LineupSampleRailDesktop({
  samples,
  recent,
  activeRequest,
  onSelect,
  disabled,
}: Props) {
  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 border-r border-[#e8dfd6] bg-[#f3ece4]/80 min-h-0">
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
            onClick={() => onSelect(ex.request)}
          />
        ))}
        {recent.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8a7f76] px-2 pt-3 pb-1">
              This session
            </p>
            {recent.map((item) => (
              <RailButton
                key={item.id}
                label={item.label}
                active={isActive(item.request, activeRequest)}
                disabled={disabled}
                onClick={() => onSelect(item.request)}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

export function LineupSampleRailMobile({
  samples,
  recent,
  activeRequest,
  onSelect,
  disabled,
}: Props) {
  const chips = [
    ...samples.map((ex) => ({
      key: `sample-${ex.label}`,
      label: ex.label,
      request: ex.request,
    })),
    ...recent.map((item) => ({
      key: `recent-${item.id}`,
      label: item.label,
      request: item.request,
    })),
  ];

  return (
    <div className="lg:hidden shrink-0 border-b border-[#e8dfd6] bg-[#f3ece4]/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#8c4a32] mb-2">
        Samples & recent
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {chips.map((chip) => {
          const active = isActive(chip.request, activeRequest);
          return (
            <button
              key={chip.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(chip.request)}
              className={cn(
                "snap-start shrink-0 max-w-[14rem] rounded-full border px-3 py-1.5 text-xs text-left transition-colors disabled:opacity-50",
                active
                  ? "border-[#8c4a32]/40 bg-[#8c4a32]/10 text-[#1a1614]"
                  : "border-[#e0d5ca] bg-[#fcf9f5] text-[#1a1614]",
              )}
            >
              <span className="line-clamp-2">{chip.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
