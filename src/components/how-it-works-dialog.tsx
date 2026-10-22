"use client";

import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

const STEPS = [
  {
    n: 1,
    title: "Describe your place.",
    body: "Three lines: concept, address, what regulars love.",
  },
  {
    n: 2,
    title: "We read your taste.",
    body: "The agent turns your venue into taste signals.",
  },
  {
    n: 3,
    title: "Qloo finds your crowd.",
    body: "Real local taste data picks the headliner, opener and neighbourhoods.",
  },
  {
    n: 4,
    title: "You get a night to book.",
    body: "Who to book, what to sell, where to promote, and every Qloo call behind it.",
  },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HowItWorksDialog({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-[#1a1614]/20"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-it-works-title"
            className={cn(
              "w-full sm:max-w-md bg-[#f7f2eb] border border-[#e8dfd6] shadow-lg",
              "rounded-t-xl sm:rounded-sm max-h-[85dvh] overflow-y-auto",
            )}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8dfd6]">
              <h2
                id="how-it-works-title"
                className="font-heading text-xl text-[#1a1614]"
              >
                How it works
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-[#6b5c52] hover:text-[#8c4a32] text-2xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <ol className="px-5 py-5 space-y-5 list-none">
              {STEPS.map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span className="shrink-0 font-heading text-2xl text-[#8c4a32] tabular-nums">
                    {step.n}
                  </span>
                  <div>
                    <p className="font-heading text-lg text-[#1a1614]">
                      {step.title}
                    </p>
                    <p className="text-sm text-[#5c534d] mt-1 leading-snug">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
