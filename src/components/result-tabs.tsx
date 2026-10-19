"use client";

import { cn } from "@/lib/utils";

export type ResultTab = "lineup" | "food" | "marketing" | "data";

const TABS: Array<{ id: ResultTab; label: string }> = [
  { id: "lineup", label: "Lineup" },
  { id: "food", label: "Food & deals" },
  { id: "marketing", label: "Marketing" },
  { id: "data", label: "Data" },
];

type Props = {
  value: ResultTab;
  onChange: (tab: ResultTab) => void;
  className?: string;
};

/** Four evenly spaced tabs above the result card. */
export function ResultTabs({ value, onChange, className }: Props) {
  return (
    <nav
      aria-label="Result views"
      role="tablist"
      className={cn(
        // Plain grid, no overflow container: an overflow-x-auto nav plus the
        // tabs' -1px underline overlap made browsers draw a scrollbar there.
        "grid grid-cols-4 items-end border-b border-[#e0d5ca]",
        className,
      )}
    >
      {TABS.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            data-result-tab={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "min-w-0 justify-self-stretch text-center pb-[9px] -mb-px border-b-[1.5px] cursor-pointer",
              "text-[10px] sm:text-[11px] font-medium uppercase leading-none tracking-[0.08em] sm:tracking-[0.16em] whitespace-nowrap",
              "focus-visible:outline-none focus-visible:text-[#1a1614]",
              on
                ? "border-[#8c4a32] text-[#1a1614]"
                : "border-transparent text-[#6b5c52] hover:text-[#1a1614]",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
