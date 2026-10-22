"use client";

import { ArtistPhoto } from "@/components/artist-photo";
import { FEED_BLOCK_CLASS } from "@/components/feed-column-layout";
import type { ExampleVenue } from "@/lib/example-venues";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { fadeUp } from "@/lib/motion";
import type { SampleRun } from "@/lib/sample-runs";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export type ExampleRoom = { venue: ExampleVenue; run: SampleRun | null };

const STEPS = [
  { n: 1, text: "Describe your room in three lines." },
  { n: 2, text: "The scout checks Qloo's taste graph for your crowd." },
  { n: 3, text: "You get a night to book, with every call behind it." },
];

type Props = {
  examples: ExampleRoom[];
  onSelect: (request: LineupRequest) => void;
  disabled?: boolean;
};

/** What a stranger sees first: what this is, three rooms to try, three steps. */
export function FirstRunPanel({ examples, onSelect, disabled }: Props) {
  return (
    <motion.div {...fadeUp} className={cn(FEED_BLOCK_CLASS, "space-y-6")} data-first-run>
      <header className="max-w-2xl">
        <h2 className="font-heading text-[30px] leading-[1.1] text-[#1a1614]">
          Tell us about your place.
        </h2>
        <p className="mt-1.5 text-[15px] leading-snug text-[#6b5c52] text-balance">
          We&apos;ll tell you who to book, who&apos;ll come, what they&apos;ll
          order, and where to find them.
        </p>
      </header>

      <section>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8c4a32] mb-2.5">
          See an example
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 list-none">
          {examples.map(({ venue, run }) => (
            <li key={venue.label}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(venue.request)}
                data-example-room
                className={cn(
                  "w-full h-full text-left rounded-md border border-[#e8dfd6] bg-[#f7f2eb] p-4 cursor-pointer",
                  "transition-[border-color,transform,box-shadow] duration-200 ease-out",
                  "hover:border-[#8c4a32]/40 hover:shadow-[0_12px_28px_-20px_rgba(26,22,20,0.35)] active:scale-[0.99] disabled:opacity-50",
                )}
              >
                <p className="font-heading text-[16px] leading-tight text-[#1a1614]">
                  {venue.label}
                </p>
                <p className="mt-1 text-[12px] text-[#6b5c52]">
                  {venue.request.regularsLove}
                </p>
                {run && (
                  <div className="mt-3 flex items-center gap-2.5 border-t border-[#e8dfd6] pt-3">
                    <ArtistPhoto
                      name={run.pitch.headliner.name}
                      imageUrl={run.pitch.headliner.imageUrl}
                      rounded="full"
                      className="h-9 w-9 text-sm"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[#8a7f76]">
                        Books
                      </p>
                      <p className="text-[13px] font-medium leading-tight truncate text-[#1a1614]">
                        {run.pitch.headliner.name}
                      </p>
                    </div>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ol className="flex flex-col sm:flex-row gap-3 sm:gap-6 list-none text-[13px] text-[#5c534d]">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-2.5 items-start sm:flex-1">
            <span className="font-heading text-[15px] leading-[1.3] text-[#8c4a32] tabular-nums">
              {s.n}
            </span>
            <span className="leading-[1.4]">{s.text}</span>
          </li>
        ))}
      </ol>
    </motion.div>
  );
}
