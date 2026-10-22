"use client";

import { Button } from "@/components/ui/button";

type Props = {
  onHowItWorks: () => void;
  onNewLineup: () => void;
};

export function AppShellTopBar({ onHowItWorks, onNewLineup }: Props) {
  return (
    <header className="shrink-0 flex items-center justify-between gap-4 border-b border-[#e8dfd6] bg-[#faf7f2]/95 backdrop-blur-sm px-4 lg:px-5 h-12 z-20">
      <span className="font-display text-xl text-[#1a1614]">
        Lineup Booker
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onHowItWorks}
          className="text-sm text-[#6b5c52] hover:text-[#8c4a32] transition-colors"
        >
          How it works
        </button>
        <Button
          type="button"
          size="sm"
          className="rounded-full bg-[#8c4a32] hover:bg-[#7a4030] text-[#faf7f2] text-xs h-8"
          onClick={onNewLineup}
        >
          New lineup
        </Button>
      </div>
    </header>
  );
}
