"use client";

import { AgentScoutStream } from "@/components/agent-scout-stream";
import { AgentStreamingPoster } from "@/components/agent-streaming-poster";
import { LineupPosterCard } from "@/components/lineup-poster-card";
import type { AgentStreamState } from "@/lib/agent/consume-agent-stream";
import type { PitchPayload } from "@/lib/agent/types";
import {
  FEED_BLOCK_CLASS,
  FEED_CARD_CLASS,
} from "@/components/feed-column-layout";
import { cn } from "@/lib/utils";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { fadeUp } from "@/lib/motion";
import { motion } from "motion/react";

function EmptyState() {
  return (
    <motion.div
      {...fadeUp}
      className={cn(
        FEED_BLOCK_CLASS,
        "rounded-sm border border-dashed border-[#e0d5ca] p-8 min-h-[280px] flex flex-col items-center justify-center text-center",
      )}
    >
      <p className="font-heading text-xl text-[#1a1614]">
        Your night shows up here
      </p>
      <p className="mt-1.5 max-w-xs text-sm text-[#8a7f76]">
        Describe your room and the scout picks a headliner, a local opener, and
        where to put the posters up.
      </p>
    </motion.div>
  );
}

type Props = {
  loading: boolean;
  error: string | null;
  agentState: AgentStreamState | null;
  form: LineupRequest;
  savedPitch: PitchPayload | null;
  /** Set when the saved pitch is a stored example run, not one scouted just now. */
  savedVenue?: { lat: number; lon: number };
  savedRunDate?: string;
  /** The saved example run is still on its way; hold a quiet placeholder instead of the empty state. */
  sampleLoading?: boolean;
  className?: string;
  scrollRef?: React.RefObject<HTMLElement | null>;
};

export function LineupResultPane({
  loading,
  error,
  agentState,
  form,
  savedPitch,
  savedVenue,
  savedRunDate,
  sampleLoading,
  className,
  scrollRef,
}: Props) {
  const pitch = savedPitch ?? agentState?.pitch;
  const showEmpty = !loading && !pitch && !error;

  return (
    <section
      ref={scrollRef as React.RefObject<HTMLElement>}
      data-result-feed
      className={cn(
        "min-w-0 space-y-4",
        "lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-6 lg:py-6 xl:px-8",
        "max-lg:px-4 max-lg:pb-10 max-lg:pt-2",
        className,
      )}
    >
      {error && (
        <div
          role="alert"
          className={cn(
            FEED_BLOCK_CLASS,
            "rounded-lg border border-[#e8dfd6] bg-[#fcf9f5] px-5 py-4 text-sm text-[#1a1614]",
          )}
        >
          {error}
        </div>
      )}

      {loading && agentState && (
        <motion.div {...fadeUp} className={FEED_BLOCK_CLASS}>
          <AgentScoutStream steps={agentState.steps} className="mb-4" />
          <AgentStreamingPoster
            state={agentState}
            venueConcept={form.concept}
            className={FEED_CARD_CLASS}
          />
        </motion.div>
      )}

      {loading && !agentState && (
        <motion.div
          {...fadeUp}
          className={cn(
            FEED_BLOCK_CLASS,
            "rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] p-6 min-h-[280px] flex items-center justify-center text-sm text-[#8a7f76]",
          )}
          aria-busy="true"
        >
          <span className="animate-pulse">Connecting to scout…</span>
        </motion.div>
      )}

      {!loading && pitch && (
        <div className={FEED_BLOCK_CLASS}>
          <AgentScoutStream
            steps={agentState?.steps ?? []}
            summary={agentState?.summary}
            collapsedDefault
            className="mb-4"
          />
          <LineupPosterCard
            key={`${pitch.headliner.id}:${pitch.opener?.id ?? "none"}:${pitch.address}`}
            pitch={pitch}
            venue={agentState?.map?.venue ?? savedVenue}
            className={FEED_CARD_CLASS}
            wideFeed
            animateSettle
            previewBadge={savedRunDate ? "saved-run" : null}
          />
        </div>
      )}

      {showEmpty &&
        (sampleLoading ? (
          <div
            className={cn(
              FEED_BLOCK_CLASS,
              "rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] min-h-[420px] animate-pulse",
            )}
            aria-busy="true"
          />
        ) : (
          <EmptyState />
        ))}
    </section>
  );
}
