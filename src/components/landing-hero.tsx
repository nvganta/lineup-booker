"use client";

import { Button } from "@/components/ui/button";
import type { ExampleVenue } from "@/lib/example-venues";
import {
  lineupRequestSchema,
  type LineupRequest,
} from "@/lib/lineup/schemas";
import { ENTER } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ArrowRight, MapPin, Music2, UtensilsCrossed } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useRef, useState } from "react";

const STEPS = [
  {
    n: 1,
    title: "Tell us about your place",
    body: "A few details about your venue and crowd.",
  },
  {
    n: 2,
    title: "We find the best match",
    body: "Qloo's taste data on your crowd, not a guess.",
  },
  {
    n: 3,
    title: "Book your lineup",
    body: "A night to remember.",
  },
];

type Props = {
  examples: ExampleVenue[];
  onSubmit: (request: LineupRequest) => void;
  onSelectExample: (request: LineupRequest) => void;
  loading: boolean;
};

const FIELD_CLASS =
  "w-full bg-transparent text-[15px] text-[#1a1614] placeholder:text-[#9a8f85] outline-none";

/** The front door: one line to start, three fields once you touch it. */
export function LandingHero({
  examples,
  onSubmit,
  onSelectExample,
  loading,
}: Props) {
  const [form, setForm] = useState<LineupRequest>({
    concept: "",
    location: "",
    regularsLove: "",
  });
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState<keyof LineupRequest | null>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof LineupRequest>(key: K, value: string) {
    setMissing(null);
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = lineupRequestSchema.safeParse(form);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.path[0] as
        | keyof LineupRequest
        | undefined;
      setMissing(first ?? "concept");
      if (!open) {
        setOpen(true);
        // Let the fields mount before moving the cursor into the next one.
        setTimeout(() => addressRef.current?.focus(), 50);
      }
      return;
    }
    onSubmit(parsed.data);
  }

  return (
    <div className="flex-1 overflow-y-auto" data-landing>
      <section className="mx-auto w-full max-w-[1400px] px-6 lg:px-12 pt-10 lg:pt-14 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.95fr] gap-10 lg:gap-14 items-center">
          <div>
            {/* Two lines, each kept whole; the size follows the column so the longer one never wraps. */}
            <h1 className="font-display text-[#1a1614] text-[clamp(2rem,4.1vw,3.9rem)] leading-[1.05]">
              <span className="block whitespace-nowrap">Your room has a vibe.</span>
              <span className="block whitespace-nowrap">
                We&apos;ll find the artists who fit.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-snug text-[#6b5c52]">
              Tell us about your venue, and we&apos;ll suggest the right
              artists using real audience taste data.
            </p>

            <form
              onSubmit={handleSubmit}
              onBlur={(e) => {
                // Focus moved outside the box: fold it back to one line.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setOpen(false);
                }
              }}
              className={cn(
                "mt-7 max-w-xl rounded-[22px] border border-[#e0d5ca] bg-[#fcf9f5]",
                "shadow-[0_1px_0_rgba(26,22,20,0.04),0_14px_30px_-22px_rgba(26,22,20,0.35)]",
                missing && "border-[#a3402a]/60",
              )}
              data-landing-form
            >
              <div className="flex items-center gap-3 pl-5 pr-2 py-2">
                <UtensilsCrossed
                  className="size-4 shrink-0 text-[#8c4a32]/80"
                  strokeWidth={1.75}
                />
                <input
                  id="landing-concept"
                  aria-label="Concept or cuisine"
                  value={form.concept}
                  onChange={(e) => set("concept", e.target.value)}
                  onFocus={() => setOpen(true)}
                  placeholder={
                    open ? "Natural wine bar, 120 seats" : "Describe your venue"
                  }
                  className={cn(FIELD_CLASS, "h-10")}
                  autoComplete="off"
                />
                {!open && (
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 shrink-0 rounded-full bg-[#8c4a32] px-5 text-[15px] text-[#faf7f2] hover:bg-[#7a4030]"
                  >
                    Find my lineup
                    <ArrowRight className="ml-1.5 size-4" />
                  </Button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="more"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={ENTER}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-[#e8dfd6] flex items-center gap-3 pl-5 pr-5 py-2">
                      <MapPin
                        className="size-4 shrink-0 text-[#8c4a32]/80"
                        strokeWidth={1.75}
                      />
                      <input
                        ref={addressRef}
                        id="landing-location"
                        aria-label="Address"
                        value={form.location}
                        onChange={(e) => set("location", e.target.value)}
                        placeholder="Address, e.g. 2509 Main St, Vancouver, BC"
                        className={cn(FIELD_CLASS, "h-10")}
                        autoComplete="off"
                      />
                    </div>
                    <div className="border-t border-[#e8dfd6] flex items-center gap-3 pl-5 pr-2 py-2">
                      <Music2
                        className="size-4 shrink-0 text-[#8c4a32]/80"
                        strokeWidth={1.75}
                      />
                      <input
                        id="landing-regulars"
                        aria-label="What regulars love"
                        value={form.regularsLove}
                        onChange={(e) => set("regularsLove", e.target.value)}
                        placeholder="What regulars love, e.g. indie folk, vinyl nights"
                        className={cn(FIELD_CLASS, "h-10")}
                        autoComplete="off"
                      />
                      <Button
                        type="submit"
                        disabled={loading}
                        className="h-11 shrink-0 rounded-full bg-[#8c4a32] px-5 text-[15px] text-[#faf7f2] hover:bg-[#7a4030]"
                      >
                        {loading ? "Scouting…" : "Find my lineup"}
                        {!loading && <ArrowRight className="ml-1.5 size-4" />}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
            {missing && (
              <p className="mt-2 text-[13px] text-[#a3402a]" role="alert">
                {missing === "concept"
                  ? "Describe your concept or cuisine."
                  : missing === "location"
                    ? "Add your address."
                    : "Tell us what regulars love."}
              </p>
            )}

            <p className="mt-3 text-[13px] text-[#6b5c52] flex flex-wrap gap-x-1.5 gap-y-1">
              <span>Try:</span>
              {examples.map((ex, i) => (
                <span key={ex.label}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onSelectExample(ex.request)}
                    className="underline underline-offset-[3px] decoration-[#d4c4b5] hover:text-[#8c4a32] hover:decoration-[#8c4a32] transition-colors cursor-pointer disabled:opacity-50"
                    data-landing-example
                  >
                    {ex.label}
                  </button>
                  {i < examples.length - 1 && <span className="text-[#c4b5a8]">,</span>}
                </span>
              ))}
            </p>
          </div>

          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl bg-[#2a211c] shadow-[0_30px_60px_-30px_rgba(26,22,20,0.5)]">
            <Image
              src="/hero-room.jpg"
              alt="A small room, candlelit, a singer with a guitar by the window"
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        <ol className="mt-12 lg:mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-[#e8dfd6] pt-8 list-none">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className={cn(
                "flex gap-4 items-start",
                i > 0 && "sm:border-l sm:border-[#e8dfd6] sm:pl-6",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#d4c4b5] font-display text-[17px] text-[#8c4a32]">
                {s.n}
              </span>
              <div>
                <p className="font-display text-[20px] leading-tight text-[#1a1614]">
                  {s.title}
                </p>
                <p className="mt-0.5 text-[14px] text-[#6b5c52]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
