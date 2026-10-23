"use client";

import { cn } from "@/lib/utils";

export type TopBarSection = { id: string; label: string };

type Props = {
  onHowItWorks: () => void;
  /** The brand is the way home; it clears the run and shows the landing. */
  onHome: () => void;
  /** Section links for the page in view; empty on the landing. */
  sections?: TopBarSection[];
  activeSection?: string;
  onJump?: (id: string) => void;
};

export function AppShellTopBar({
  onHowItWorks,
  onHome,
  sections = [],
  activeSection,
  onJump,
}: Props) {
  return (
    <header className="shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-[#e8dfd6] bg-[#faf7f2]/95 backdrop-blur-sm px-4 lg:px-5 h-12 z-20">
      <button
        type="button"
        onClick={onHome}
        className="font-display text-xl text-[#1a1614] cursor-pointer hover:text-[#8c4a32] transition-colors"
        aria-label="Lineup Booker, start over"
      >
        Lineup Booker
      </button>
      <nav
        aria-label="Sections"
        className={cn(
          "flex min-w-0 justify-center gap-1 overflow-x-auto",
          sections.length === 0 && "invisible",
        )}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onJump?.(s.id)}
            data-section-link={s.id}
            aria-current={activeSection === s.id ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[12.5px] transition-colors cursor-pointer",
              activeSection === s.id
                ? "bg-[#1a1614] text-[#faf7f2]"
                : "text-[#6b5c52] hover:text-[#1a1614] hover:bg-[#f0e8de]",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <button
        type="button"
        onClick={onHowItWorks}
        className="text-sm text-[#6b5c52] hover:text-[#8c4a32] transition-colors"
      >
        How it works
      </button>
    </header>
  );
}
