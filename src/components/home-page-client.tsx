"use client";

import { AppShellTopBar } from "@/components/app-shell-top-bar";
import { HowItWorksSection } from "@/components/how-it-works-section";
import { LineupForm } from "@/components/lineup-form";
import { LineupResultPane } from "@/components/lineup-result-pane";
import {
  LineupSampleRailDesktop,
  LineupSampleRailMobile,
} from "@/components/lineup-sample-rail";
import { ScoutingLog } from "@/components/scouting-log";
import {
  consumeAgentStream,
  type AgentStreamState,
} from "@/lib/agent/consume-agent-stream";
import {
  emptyAgentStreamState,
  recoverIncompleteAgentStream,
} from "@/lib/agent/stream-recover";
import { EXAMPLE_VENUES } from "@/lib/example-venues";
import type { LineupResult } from "@/lib/lineup/build-lineup";
import {
  pushRecentLineup,
  type RecentLineup,
} from "@/lib/recent-lineups";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { useEffect, useRef, useState } from "react";

const DEFAULT_REQUEST: LineupRequest = EXAMPLE_VENUES[0]!.request;

export function HomePageClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentStreamState | null>(null);
  const [openingSample, setOpeningSample] = useState<LineupResult | null>(null);
  const [openingLoading, setOpeningLoading] = useState(true);
  const [form, setForm] = useState<LineupRequest>(DEFAULT_REQUEST);
  const [recentLineups, setRecentLineups] = useState<RecentLineup[]>([]);
  const resultFeedRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.body.classList.add("lineup-app-shell");
    return () => {
      document.body.classList.remove("lineup-app-shell");
    };
  }, []);

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

  function selectRequest(request: LineupRequest) {
    setForm(request);
    setAddressError(null);
  }

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
      const consumed = await consumeAgentStream(res, setAgentState);
      let streamState = consumed.state;
      if (!consumed.terminal) {
        streamState = await recoverIncompleteAgentStream(
          streamState,
          data,
          setAgentState,
        );
      }
      if (!streamState.pitch) {
        setError("Scout could not finish this run. Try again.");
        return;
      }
      setRecentLineups((prev) =>
        pushRecentLineup(
          prev,
          data,
          streamState.pitch?.venueLabel ?? undefined,
        ),
      );
    } catch {
      const recovered = await recoverIncompleteAgentStream(
        emptyAgentStreamState(),
        data,
        setAgentState,
      );
      if (!recovered.pitch) {
        setError("Network error. Try again.");
        return;
      }
      setRecentLineups((prev) =>
        pushRecentLineup(
          prev,
          data,
          recovered.pitch?.venueLabel ?? undefined,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  const railProps = {
    samples: EXAMPLE_VENUES,
    recent: recentLineups,
    activeRequest: form,
    onSelect: selectRequest,
    disabled: loading,
  };

  const showScoutingLog =
    loading || (agentState?.steps.length ?? 0) > 0;

  return (
    <main className="relative flex flex-col bg-[#faf7f2] flex-1 max-lg:min-h-full lg:h-[100dvh] lg:max-h-[100dvh] lg:overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35] bg-[length:280px_280px] bg-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='280' height='280' xmlns='http://www.w3.org/2000/svg'%3E%3Crect fill='%23faf7f2' width='280' height='280'/%3E%3Cpath fill='%23f0e8de' d='M0 140h280M140 0v280'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      <AppShellTopBar />
      <LineupSampleRailMobile {...railProps} />

      <div className="relative z-10 flex flex-col lg:flex-row flex-1 min-h-0 max-lg:overflow-visible">
        <LineupSampleRailDesktop {...railProps} />

        <div className="flex flex-col lg:flex-row flex-1 min-h-0 max-lg:overflow-visible">
          <div className="shrink-0 w-full lg:w-[20rem] xl:w-[22rem] lg:border-r border-[#e8dfd6] bg-[#faf7f2]/95 lg:overflow-y-auto lg:overscroll-contain px-4 py-5 lg:px-5 space-y-6">
            <LineupForm
              value={form}
              onChange={setForm}
              onSubmit={handleSubmit}
              loading={loading}
              addressError={addressError}
            />
            {showScoutingLog && agentState && (
              <ScoutingLog
                steps={agentState.steps}
                summary={agentState.summary}
              />
            )}
            <div className="hidden lg:block">
              <HowItWorksSection />
            </div>
          </div>

          <LineupResultPane
            loading={loading}
            error={error}
            agentState={agentState}
            form={form}
            openingSample={openingSample}
            openingLoading={openingLoading}
            scrollRef={resultFeedRef}
          />
        </div>
      </div>

      <div className="lg:hidden px-4 pb-8 relative z-10">
        <HowItWorksSection />
      </div>
    </main>
  );
}
