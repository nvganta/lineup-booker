"use client";

import { INDICATOR } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { CircleHelp, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "motion/react";

export type TopBarSection = { id: string; label: string };

type Props = {
  onHowItWorks: () => void;
  /** The brand is the way home; it clears the run and shows the landing. */
  onHome: () => void;
  /** Section links for the page in view; empty on the landing. */
  sections?: TopBarSection[];
  activeSection?: string;
  onJump?: (id: string) => void;
  /** The details sidebar beside the lineup, when there is one. */
  sidebar?: { open: boolean; onToggle: () => void };
};

export function AppShellTopBar({
  onHowItWorks,
  onHome,
  sections = [],
  activeSection,
  onJump,
  sidebar,
}: Props) {
  return (
    <header
      className={cn(
        "shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-[#e8dfd6] bg-[#faf7f2]/95 backdrop-blur-sm px-4 lg:px-6 h-14 z-20",
        // From xl the first column matches the open 22rem sidebar, so the section
        // nav centres over the lineup it scrolls rather than over the whole window.
        sidebar?.open && "xl:grid-cols-[calc(22rem-1rem)_1fr_auto_1fr]",
      )}
    >
      <div className="justify-self-start flex items-center gap-2">
        {sidebar && (
          <button
            type="button"
            onClick={sidebar.onToggle}
            aria-label={
              sidebar.open ? "Hide venue details" : "Show venue details"
            }
            aria-expanded={sidebar.open}
            title={sidebar.open ? "Hide venue details" : "Show venue details"}
            className="max-lg:hidden -ml-1.5 rounded-md p-1.5 text-[#8a7f76] hover:text-[#1a1614] hover:bg-[#f0e8de] transition-colors cursor-pointer"
          >
            {sidebar.open ? (
              <PanelLeftClose className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onHome}
          className="font-display text-[22px] leading-none text-[#1a1614] cursor-pointer hover:text-[#8c4a32] transition-colors"
          aria-label="Lineup Booker, start over"
        >
          Lineup Booker
        </button>
      </div>

      {/* One segmented control; the dark pill slides to the section in view. */}
      <nav
        aria-label="Sections"
        className={cn(
          "flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-[#e8dfd6] bg-[#f3ece4]/80 p-1",
          sidebar?.open && "xl:col-start-3",
          sections.length === 0 && "invisible",
        )}
      >
        {sections.map((s) => {
          const on = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onJump?.(s.id)}
              data-section-link={s.id}
              aria-current={on ? "true" : undefined}
              className={cn(
                "relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] leading-none transition-colors cursor-pointer",
                on ? "text-[#faf7f2]" : "text-[#5c534d] hover:text-[#1a1614]",
              )}
            >
              {on && (
                <motion.span
                  layoutId="topbar-pill"
                  transition={INDICATOR}
                  className="absolute inset-0 rounded-full bg-[#1a1614] shadow-[0_1px_2px_rgba(26,22,20,0.25)]"
                  aria-hidden
                />
              )}
              <span className="relative">{s.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onHowItWorks}
        className={cn(
          "justify-self-end inline-flex items-center gap-1.5 rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-3.5 py-1.5 text-[13px] leading-none text-[#5c534d] hover:text-[#8c4a32] hover:border-[#8c4a32]/40 transition-colors cursor-pointer",
          sidebar?.open && "xl:col-start-4",
        )}
      >
        <CircleHelp className="size-3.5" strokeWidth={2} />
        How it works
      </button>
    </header>
  );
}
