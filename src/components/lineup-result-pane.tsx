"use client";

import { AgentScoutStream } from "@/components/agent-scout-stream";
import { AgentStreamingPoster } from "@/components/agent-streaming-poster";
import { LineupPage } from "@/components/lineup-page";
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

type Props = {
  loading: boolean;
  error: string | null;
  agentState: AgentStreamState | null;
  form: LineupRequest;
  savedPitch: PitchPayload | null;
  /** Set when the saved pitch is a stored example run, not one scouted just now. */
  savedVenue?: { lat: number; lon: number };
  onAudience?: (line: string | null) => void;
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
  onAudience,
  className,
  scrollRef,
}: Props) {
  const pitch = savedPitch ?? agentState?.pitch;

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
      {error && (
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

      {loading && agentState && (
        <motion.div {...fadeUp} className={cn(FEED_BLOCK_CLASS, "pt-4")}>
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
            "mt-4 rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] p-6 min-h-[280px] flex items-center justify-center text-sm text-[#8a7f76]",
          )}
          aria-busy="true"
        >
          <span className="animate-pulse">Connecting to scout…</span>
        </motion.div>
      )}

      {!loading && pitch && (
        <div className={FEED_BLOCK_CLASS}>
          <LineupPage
            key={`${pitch.headliner.id}:${pitch.opener?.id ?? "none"}:${pitch.address}`}
            pitch={pitch}
            venue={agentState?.map?.venue ?? savedVenue}
            when={form.when?.trim() || undefined}
            onAudience={onAudience}
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
        </div>
      )}
    </section>
  );
}
