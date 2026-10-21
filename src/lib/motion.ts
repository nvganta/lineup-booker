import type { Transition } from "motion/react";

/** Strong ease-out: fast start, soft landing. Reads as responsive, never sluggish. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export const ENTER: Transition = { duration: 0.32, ease: EASE_OUT };

/** Short and stiff enough that a moving indicator never overshoots its target. */
export const INDICATOR: Transition = { type: "spring", duration: 0.35, bounce: 0.12 };

/** Fade up a few pixels. Opacity and transform only, so it stays on the compositor. */
export const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: ENTER,
} as const;
