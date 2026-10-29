"use client";

import { EASE_OUT, ENTER } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  Megaphone,
  Mic2,
  Radar,
  Send,
  Store,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

type Step = { icon: LucideIcon; title: string; body: string; you?: boolean };

const STEPS: Step[] = [
  {
    icon: Store,
    title: "Tell us about your place",
    body: "Three lines: what it is and how many it holds, where it is, and what your regulars love.",
    you: true,
  },
  {
    icon: Radar,
    title: "Qloo reads your crowd",
    body: "Your words become Qloo taste tags. The scout finds acts your crowd already loves near you, and maps where their fans live.",
  },
  {
    icon: Mic2,
    title: "Who to book",
    body: "A headliner sized to your room and a local opener whose fans overlap. Hear both before you decide.",
  },
  {
    icon: Wine,
    title: "What to sell",
    body: "Where the headliner's fans eat and drink, against the rest of the city, turned into specials for the night.",
  },
  {
    icon: Megaphone,
    title: "Where to promote",
    body: "The neighbourhoods to poster first, the spots to leave flyers, a poster with your date, and posts ready to copy.",
  },
  {
    icon: Send,
    title: "Book the night",
    body: "A drafted email to each act and a one-page brief for your staff. Lock the headliner first, then the opener.",
    you: true,
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HowItWorksDialog({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="how-it-works"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-[#1a1614]/40 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-it-works-title"
            className={cn(
              "relative w-full sm:max-w-4xl bg-[#faf7f2] border border-[#e8dfd6] shadow-[0_40px_80px_-30px_rgba(26,22,20,0.45)]",
              "rounded-t-2xl sm:rounded-xl max-h-[90dvh] overflow-y-auto",
            )}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1.5 text-[#6b5c52] hover:text-[#1a1614] hover:bg-[#f0e8de] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={2} />
            </button>

            <header className="px-6 sm:px-10 pt-8 pb-6 border-b border-[#e8dfd6]">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8c4a32]">
                How it works
              </p>
              <h2
                id="how-it-works-title"
                className="mt-2 font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.05] text-[#1a1614]"
              >
                Three lines in. A night ready to host out.
              </h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-snug text-[#6b5c52]">
                Independent rooms book on gut and group chats. Lineup Booker books from what your crowd
                actually loves, using Qloo&apos;s taste data, then gets the night ready: who plays, what you
                pour, and who hears about it.
              </p>
            </header>

            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#e8dfd6] list-none">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.li
                    key={step.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...ENTER, delay: 0.06 + i * 0.05 }}
                    className="bg-[#faf7f2] px-6 py-6"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-full",
                          step.you ? "bg-[#1a1614] text-[#faf7f2]" : "bg-[#8c4a32]/10 text-[#8c4a32]",
                        )}
                      >
                        <Icon className="size-[18px]" strokeWidth={1.75} />
                      </span>
                      <span className="font-display text-[15px] text-[#8c4a32] tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="mt-3.5 font-heading text-[17px] leading-tight text-[#1a1614]">
                      {step.title}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-[1.5] text-[#5c534d]">{step.body}</p>
                  </motion.li>
                );
              })}
            </ol>

            <footer className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 sm:px-10 py-5 border-t border-[#e8dfd6]">
              <p className="text-[12.5px] text-[#6b5c52] max-w-xl">
                Every act, neighbourhood and number comes from a Qloo request, and you can see each one under{" "}
                <span className="text-[#1a1614]">How we got here</span>.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 h-10 rounded-full bg-[#8c4a32] px-5 text-[14px] text-[#faf7f2] hover:bg-[#7a4030] transition-colors cursor-pointer"
              >
                Got it
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
