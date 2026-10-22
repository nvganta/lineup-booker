"use client";

import { AppShellTopBar } from "@/components/app-shell-top-bar";
import { HowItWorksDialog } from "@/components/how-it-works-dialog";
import { LandingHero } from "@/components/landing-hero";
import { LineupForm } from "@/components/lineup-form";
import { LineupResultPane } from "@/components/lineup-result-pane";
import {
  RecentRailDesktop,
  RecentRailMobile,
} from "@/components/lineup-sample-rail";
import {
  consumeAgentStream,
  type AgentStreamState,
} from "@/lib/agent/consume-agent-stream";
import {
  emptyAgentStreamState,
  recoverIncompleteAgentStream,
} from "@/lib/agent/stream-recover";
import type { PitchPayload } from "@/lib/agent/types";
import { EXAMPLE_VENUES } from "@/lib/example-venues";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { rememberPlainAnswer } from "@/components/without-qloo-view";
import { rememberAnalytics } from "@/hooks/use-pitch-analytics";
import type { SampleRun, SampleRuns } from "@/lib/sample-runs";
import {
  cityFromRequest,
  getServerStoredLineups,
  loadStoredLineups,
  storedLineupId,
  subscribeStoredLineups,
  toggleStoredPin,
  upsertStoredLineup,
  type StoredLineup,
} from "@/lib/stored-lineups";
import { cn } from "@/lib/utils";
import { MotionConfig } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const EMPTY_REQUEST: LineupRequest = {
  concept: "",
  location: "",
  regularsLove: "",
};

function sampleRunFor(
  request: LineupRequest,
  runs: SampleRuns,
): SampleRun | null {
  return EXAMPLE_VENUES.some((ex) => ex.request === request)
    ? (runs[request.location] ?? null)
    : null;
}

export function HomePageClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentStreamState | null>(null);
  const [form, setForm] = useState<LineupRequest>(EMPTY_REQUEST);
  const storedLineups = useSyncExternalStore(
    subscribeStoredLineups,
    loadStoredLineups,
    getServerStoredLineups,
  );
  const [sampleRuns, setSampleRuns] = useState<SampleRuns>({});
  const [savedRun, setSavedRun] = useState<SampleRun | null>(null);
  const [savedPitch, setSavedPitch] = useState<PitchPayload | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const resultFeedRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.body.classList.add("lineup-app-shell");
    return () => {
      document.body.classList.remove("lineup-app-shell");
    };
  }, []);

  // Saved runs make the example rooms open instantly: no Qloo calls on page load.
  useEffect(() => {
    let live = true;
    fetch("/api/sample-runs")
      .then((r): Promise<SampleRuns> | SampleRuns => (r.ok ? r.json() : {}))
      .then((runs) => {
        if (!live) return;
        for (const run of Object.values(runs)) {
          rememberPlainAnswer(run);
          rememberAnalytics(run);
        }
        setSampleRuns(runs);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  function selectRequest(request: LineupRequest) {
    const run = sampleRunFor(request, sampleRuns);
    setForm(request);
    setAddressError(null);
    setSavedRun(run);
    setSavedPitch(run?.pitch ?? null);
    setAgentState(null);
    setError(null);
  }

  function openStored(item: StoredLineup) {
    setForm(item.request);
    setSavedRun(null);
    setSavedPitch(item.pitch);
    setAgentState(null);
    setError(null);
    setAddressError(null);
  }

  function handleNewLineup() {
    setForm(EMPTY_REQUEST);
    setSavedRun(null);
    setSavedPitch(null);
    setAgentState(null);
    setError(null);
    setAddressError(null);
    setLoading(false);
  }

  function persistPitch(request: LineupRequest, pitch: PitchPayload) {
    const entry: StoredLineup = {
      id: storedLineupId(request, pitch),
      venueLabel: pitch.venueLabel,
      cityLabel: pitch.meta?.cityLabel ?? cityFromRequest(request),
      headlinerName: pitch.headliner.name,
      headlinerImageUrl: pitch.headliner.imageUrl,
      request,
      pitch,
      savedAt: Date.now(),
    };
    upsertStoredLineup(entry);
  }

  async function handleSubmit(data: LineupRequest) {
    setLoading(true);
    setError(null);
    setAddressError(null);
    setAgentState(null);
    setSavedRun(null);
    setSavedPitch(null);
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
      persistPitch(data, streamState.pitch);
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
      persistPitch(data, recovered.pitch);
    } finally {
      setLoading(false);
    }
  }

  // The landing is the front door; the shell appears once there is a run to show.
  const showLanding = !loading && !savedPitch && !agentState?.pitch && !error;

  const railProps = {
    stored: storedLineups,
    onOpenStored: openStored,
    onTogglePin: (id: string) => {
      toggleStoredPin(id);
    },
    disabled: loading,
  };

  return (
    // Honour the OS "reduce motion" setting for every animation below.
    <MotionConfig reducedMotion="user">
      <main className="relative flex flex-col bg-[#faf7f2] flex-1 max-lg:min-h-full lg:h-[100dvh] lg:max-h-[100dvh] lg:overflow-hidden">
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.35] bg-[length:280px_280px] bg-repeat"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='280' height='280' xmlns='http://www.w3.org/2000/svg'%3E%3Crect fill='%23faf7f2' width='280' height='280'/%3E%3Cpath fill='%23f0e8de' d='M0 140h280M140 0v280'/%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />

        <AppShellTopBar
          onHowItWorks={() => setHowOpen(true)}
          onNewLineup={handleNewLineup}
        />
        <HowItWorksDialog open={howOpen} onClose={() => setHowOpen(false)} />

        {showLanding ? (
          <div className="relative z-10 flex flex-col flex-1 min-h-0">
            <LandingHero
              examples={EXAMPLE_VENUES}
              onSubmit={(data) => {
                setForm(data);
                void handleSubmit(data);
              }}
              onSelectExample={selectRequest}
              loading={loading}
            />
          </div>
        ) : (
          <>
            <RecentRailMobile {...railProps} />

            <div className="relative z-10 flex flex-col lg:flex-row flex-1 min-h-0 max-lg:overflow-visible">
              <RecentRailDesktop {...railProps} />

              <div className="flex flex-col lg:flex-row flex-1 min-h-0 max-lg:overflow-visible">
                <div className="shrink-0 w-full lg:w-[20rem] xl:w-[22rem] lg:border-r border-[#e8dfd6] bg-[#faf7f2]/95 lg:overflow-hidden px-4 py-5 lg:px-5">
                  <LineupForm
                    value={form}
                    onChange={setForm}
                    onSubmit={handleSubmit}
                    loading={loading}
                    addressError={addressError}
                  />
                  <div className="mt-6 pt-4 border-t border-[#e8dfd6]">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8a7f76] mb-2">
                        Examples
                      </p>
                      <ul className="list-none space-y-1">
                        {EXAMPLE_VENUES.map((ex) => (
                          <li key={ex.label}>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => selectRequest(ex.request)}
                              className={cn(
                                "text-sm text-[#6b5c52] hover:text-[#8c4a32] disabled:opacity-50 transition-colors",
                              )}
                            >
                              {ex.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                </div>

                <LineupResultPane
                  loading={loading}
                  error={error}
                  agentState={agentState}
                  form={form}
                  savedPitch={savedPitch}
                  savedVenue={savedRun?.venue}
                  scrollRef={resultFeedRef}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </MotionConfig>
  );
}
