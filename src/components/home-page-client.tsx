"use client";

import { AgentResultCard } from "@/components/agent-result-card";
import { AgentStreamingPoster } from "@/components/agent-streaming-poster";
import { LineupCard } from "@/components/lineup-card";
import { LineupForm } from "@/components/lineup-form";
import { ScoutingLog } from "@/components/scouting-log";
import {
  consumeAgentStream,
  type AgentStreamState,
} from "@/lib/agent/consume-agent-stream";
import { EXAMPLE_VENUES } from "@/lib/example-venues";
import type { LineupResult } from "@/lib/lineup/build-lineup";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { useEffect, useState } from "react";

const DEFAULT_REQUEST: LineupRequest = EXAMPLE_VENUES[0]!.request;

function PreviewSkeleton() {
  return (
    <div className="max-w-xl mx-auto rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] p-5 animate-pulse min-h-[420px]" />
  );
}

export function HomePageClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentStreamState | null>(null);
  const [openingSample, setOpeningSample] = useState<LineupResult | null>(null);
  const [openingLoading, setOpeningLoading] = useState(true);
  const [form, setForm] = useState<LineupRequest>(DEFAULT_REQUEST);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/opening-sample", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { lineup?: LineupResult };
        if (!cancelled && json.lineup) setOpeningSample(json.lineup);
      } finally {
        if (!cancelled) setOpeningLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(data: LineupRequest) {
    setLoading(true);
    setError(null);
    setAddressError(null);
    setAgentState(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (json.code === "geocode") {
          setAddressError(json.error ?? "Couldn't find that address.");
        } else {
          setError(json.error ?? "Scout failed.");
        }
        return;
      }
      await consumeAgentStream(res, setAgentState);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const pitch = agentState?.pitch;
  const showPreview = !loading && !pitch && !error;

  return (
    <main className="min-h-full bg-[#faf7f2] flex-1">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35] bg-[length:280px_280px] bg-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='280' height='280' xmlns='http://www.w3.org/2000/svg'%3E%3Crect fill='%23faf7f2' width='280' height='280'/%3E%3Cpath fill='%23f0e8de' d='M0 140h280M140 0v280'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 py-12 md:py-16 lg:px-10">
        <div className="grid gap-10 lg:gap-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-start">
          <div className="space-y-8">
            <LineupForm
              value={form}
              onChange={setForm}
              onSubmit={handleSubmit}
              loading={loading}
              addressError={addressError}
              examples={EXAMPLE_VENUES}
              onExampleSelect={(ex) => setForm(ex.request)}
            />
            {(agentState?.steps.length ?? 0) > 0 && (
              <ScoutingLog
                steps={agentState!.steps}
                summary={agentState!.summary}
              />
            )}
          </div>

          <div className="lg:sticky lg:top-10 space-y-6 min-h-[320px]">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-[#e8dfd6] bg-[#fcf9f5] px-5 py-4 text-sm text-[#1a1614] max-w-xl"
              >
                {error}
              </div>
            )}

            {loading && agentState && (
              <AgentStreamingPoster
                state={agentState}
                venueConcept={form.concept}
              />
            )}

            {loading && !agentState && (
              <div
                className="max-w-xl mx-auto rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] p-6 min-h-[280px] flex items-center justify-center text-sm text-[#8a7f76]"
                aria-busy="true"
              >
                Connecting to scout…
              </div>
            )}

            {!loading && pitch && (
              <div className="animate-lineup-settle">
                <AgentResultCard
                  pitch={pitch}
                  venue={agentState?.map?.venue}
                />
              </div>
            )}

            {showPreview && openingLoading && <PreviewSkeleton />}

            {showPreview && !openingLoading && openingSample && (
              <LineupCard lineup={openingSample} preview />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
