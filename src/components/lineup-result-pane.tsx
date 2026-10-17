"use client";

import { AgentResultCard } from "@/components/agent-result-card";
import { AgentStreamingPoster } from "@/components/agent-streaming-poster";
import { LineupCard } from "@/components/lineup-card";
import type { AgentStreamState } from "@/lib/agent/consume-agent-stream";
import type { LineupResult } from "@/lib/lineup/build-lineup";
import {
  FEED_BLOCK_CLASS,
  FEED_CARD_CLASS,
} from "@/components/feed-column-layout";
import { cn } from "@/lib/utils";
import type { LineupRequest } from "@/lib/lineup/schemas";

function PreviewSkeleton() {
  return (
    <div
      className={cn(
        FEED_BLOCK_CLASS,
        "rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] p-5 animate-pulse min-h-[420px]",
      )}
    />
  );
}

type Props = {
  loading: boolean;
  error: string | null;
  agentState: AgentStreamState | null;
  form: LineupRequest;
  openingSample: LineupResult | null;
  openingLoading: boolean;
  className?: string;
  scrollRef?: React.RefObject<HTMLElement | null>;
};

export function LineupResultPane({
  loading,
  error,
  agentState,
  form,
  openingSample,
  openingLoading,
  className,
  scrollRef,
}: Props) {
  const pitch = agentState?.pitch;
  const showPreview = !loading && !pitch && !error;

  return (
    <section
      ref={scrollRef as React.RefObject<HTMLElement>}
      data-result-feed
      className={cn(
        "min-w-0 space-y-6",
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
        <AgentStreamingPoster
          state={agentState}
          venueConcept={form.concept}
          className={FEED_CARD_CLASS}
        />
      )}

      {loading && !agentState && (
        <div
          className={cn(
            FEED_BLOCK_CLASS,
            "rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] p-6 min-h-[280px] flex items-center justify-center text-sm text-[#8a7f76]",
          )}
          aria-busy="true"
        >
          Connecting to scout…
        </div>
      )}

      {!loading && pitch && (
        <div className={cn("animate-lineup-settle", FEED_BLOCK_CLASS)}>
          <AgentResultCard
            pitch={pitch}
            venue={agentState?.map?.venue}
            className={FEED_CARD_CLASS}
            wideFeed
          />
        </div>
      )}

      {showPreview && openingLoading && <PreviewSkeleton />}

      {showPreview && !openingLoading && openingSample && (
        <div className={FEED_BLOCK_CLASS}>
          <LineupCard
            lineup={openingSample}
            preview
            wideFeed
            className={cn(FEED_CARD_CLASS, "scale-100 opacity-100")}
          />
        </div>
      )}
    </section>
  );
}
