"use client";

import { AgentScoutStream } from "@/components/agent-scout-stream";
import { LineupPage } from "@/components/lineup-page";
import { replayStepsFor, ScoutProgress } from "@/components/scout-progress";
import type { AgentStreamState } from "@/lib/agent/consume-agent-stream";
import type { ArtistDataPart, PitchPayload } from "@/lib/agent/types";
import {
  FEED_BLOCK_CLASS,
  FEED_CARD_CLASS,
} from "@/components/feed-column-layout";
import { venueDisplayName } from "@/lib/lineup/venue-display";
import { cn } from "@/lib/utils";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { EASE_OUT } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/** How long the finished checklist stays up before the page fades in. */
const HOLD_MS = 900;
/** One replayed stage every this many ms for a saved example run. */
const REPLAY_STEP_MS = 230;

type Props = {
  loading: boolean;
  error: string | null;
  agentState: AgentStreamState | null;
  form: LineupRequest;
  savedPitch: PitchPayload | null;
  /** Set when the saved pitch is a stored example run, not one scouted just now. */
  savedVenue?: { lat: number; lon: number };
  /** Changes each time an example room is opened, to play its scout back. */
  replayKey?: number | null;
  onAudience?: (line: string | null) => void;
  onActiveSection?: (id: string) => void;
  className?: string;
  scrollRef?: React.RefObject<HTMLElement | null>;
};

function artistsOf(pitch: PitchPayload): ArtistDataPart[] {
  return [
    { ...pitch.headliner, role: "headliner" },
    ...(pitch.opener ? [{ ...pitch.opener, role: "opener" as const }] : []),
  ];
}

export function LineupResultPane({
  loading,
  error,
  agentState,
  form,
  savedPitch,
  savedVenue,
  replayKey = null,
  onAudience,
  onActiveSection,
  className,
  scrollRef,
}: Props) {
  const pitch = savedPitch ?? agentState?.pitch;

  // A live scout that just finished holds its checklist a beat, so the owner sees it land.
  const [hold, setHold] = useState(false);
  const [prevLoading, setPrevLoading] = useState(loading);
  if (prevLoading !== loading) {
    setPrevLoading(loading);
    if (!loading && agentState?.pitch) setHold(true);
  }
  useEffect(() => {
    if (!hold) return;
    const t = setTimeout(() => setHold(false), HOLD_MS);
    return () => clearTimeout(t);
  }, [hold]);

  // Example rooms open from a saved run; play its steps back quickly instead of jumping.
  const [replayed, setReplayed] = useState<number | null>(() =>
    replayKey != null ? 0 : null,
  );
  const [prevReplayKey, setPrevReplayKey] = useState(replayKey);
  if (prevReplayKey !== replayKey) {
    setPrevReplayKey(replayKey);
    setReplayed(replayKey != null ? 0 : null);
  }
  const replaySteps =
    replayed != null && savedPitch ? replayStepsFor(savedPitch) : [];
  const replayEnd = replaySteps.length + Math.ceil(HOLD_MS / REPLAY_STEP_MS);
  useEffect(() => {
    if (replayed == null) return;
    const t = setTimeout(
      () => setReplayed((n) => (n == null || n >= replayEnd ? null : n + 1)),
      REPLAY_STEP_MS,
    );
    return () => clearTimeout(t);
  }, [replayed, replayEnd]);

  const venue = venueDisplayName(
    form.concept || pitch?.venueLabel || "your room",
  );
  const replaying = replayed != null && Boolean(savedPitch);
  const showProgress = loading || hold || replaying;

  return (
    <section
      ref={scrollRef as React.RefObject<HTMLElement>}
      data-result-feed
      className={cn(
        "min-w-0 space-y-4",
        "lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-6 lg:pb-10 xl:px-8",
        "max-lg:px-4 max-lg:pb-10 max-lg:pt-2",
        className,
      )}
    >
      {error && !loading && (
        <div
          role="alert"
          className={cn(
            FEED_BLOCK_CLASS,
            "mt-4 rounded-lg border border-[#e8dfd6] bg-[#fcf9f5] px-5 py-4 text-sm text-[#1a1614]",
          )}
        >
          {error}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {showProgress ? (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className={cn(FEED_BLOCK_CLASS, "pt-5 max-w-2xl")}
          >
            {replaying && savedPitch ? (
              <ScoutProgress
                steps={replaySteps.slice(0, replayed ?? 0)}
                artists={artistsOf(savedPitch)}
                venue={venue}
                finished={(replayed ?? 0) >= replaySteps.length}
                replay
              />
            ) : (
              <ScoutProgress
                steps={agentState?.steps ?? []}
                artists={
                  agentState?.pitch
                    ? artistsOf(agentState.pitch)
                    : agentState?.artists
                }
                venue={venue}
                finished={hold}
              />
            )}
          </motion.div>
        ) : pitch ? (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className={FEED_BLOCK_CLASS}
          >
            <LineupPage
              key={`${pitch.headliner.id}:${pitch.opener?.id ?? "none"}:${pitch.address}`}
              pitch={pitch}
              venue={agentState?.map?.venue ?? savedVenue}
              when={form.when?.trim() || undefined}
              onAudience={onAudience}
              onActiveSection={onActiveSection}
              className={FEED_CARD_CLASS}
              animateSettle
            />
            {agentState?.steps && agentState.steps.length > 0 && (
              <AgentScoutStream
                steps={agentState.steps}
                summary={agentState.summary}
                collapsedDefault
                className="mt-6"
              />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
