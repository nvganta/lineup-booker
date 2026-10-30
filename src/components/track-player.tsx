"use client";

import type { TrackPreview } from "@/lib/preview/itunes";
import { cn } from "@/lib/utils";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const memo = new Map<string, TrackPreview[]>();

/** One audio element for the whole page, so starting a track stops the last one. */
const player: { el: HTMLAudioElement | null; currentId: string | null } = {
  el: null,
  currentId: null,
};
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}
function audio(): HTMLAudioElement {
  if (!player.el) {
    const el = new Audio();
    el.preload = "none";
    el.addEventListener("ended", () => {
      player.currentId = null;
      notify();
    });
    el.addEventListener("pause", notify);
    el.addEventListener("play", notify);
    el.addEventListener("timeupdate", notify);
    player.el = el;
  }
  return player.el;
}

/** Play, pause or resume one preview; lives outside React so it can own the shared player. */
function toggleTrack(t: TrackPreview): void {
  const a = audio();
  if (player.currentId === t.id) {
    if (a.paused) void a.play();
    else a.pause();
    return;
  }
  a.src = t.previewUrl;
  player.currentId = t.id;
  void a.play().catch(() => {
    player.currentId = null;
    notify();
  });
  notify();
}

function usePreviews(artist: string) {
  const [, bump] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (memo.has(artist)) return;
    let live = true;
    fetch(`/api/preview?artist=${encodeURIComponent(artist)}`)
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((j: { tracks?: TrackPreview[] }) => {
        memo.set(artist, j.tracks ?? []);
        if (live) bump((n) => n + 1);
      })
      .catch(() => live && setFailed(artist));
    return () => {
      live = false;
    };
  }, [artist]);
  const tracks = memo.get(artist);
  if (tracks) return { status: "ready" as const, tracks };
  return failed === artist ? { status: "error" as const, tracks: [] } : { status: "loading" as const, tracks: [] };
}

function usePlayback() {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const a = player.el;
  return {
    currentId: player.currentId,
    playing: Boolean(a && !a.paused && player.currentId),
    progress: a && a.duration > 0 ? a.currentTime / a.duration : 0,
  };
}

type Props = {
  artist: string;
  /** One row with play buttons only, for the alternates. */
  compact?: boolean;
  className?: string;
};

/** 30-second previews from Apple, played in place. */
export function TrackPlayer({ artist, compact, className }: Props) {
  const { status, tracks } = usePreviews(artist);
  const { currentId: nowId, playing, progress } = usePlayback();
  const rowRef = useRef<HTMLDivElement>(null);

  const toggle = toggleTrack;

  if (status === "loading") {
    return (
      <div className={cn("text-[11px] text-[#8a7f76]", className)} aria-busy="true" data-previews="loading">
        Finding previews…
      </div>
    );
  }
  if (tracks.length === 0) {
    return (
      <div className={cn("text-[11px] text-[#8a7f76]", className)} data-previews="none">
        No previews found for {artist}.
      </div>
    );
  }

  if (compact) {
    return (
      <div ref={rowRef} className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)} data-previews="compact">
        {tracks.slice(0, 2).map((t) => {
          const on = nowId === t.id && playing;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t)}
              title={t.title}
              aria-label={`${on ? "Pause" : "Play"} ${t.title}`}
              className={cn(
                "inline-flex h-6 min-w-0 max-w-full items-center gap-1 rounded-full border px-1.5 text-[10.5px] cursor-pointer transition-colors",
                on ? "border-[#8c4a32] bg-[#8c4a32] text-[#faf7f2]" : "border-[#e0d5ca] bg-[#fcf9f5] text-[#3d3530] hover:border-[#8c4a32]/40",
              )}
            >
              {on ? <Pause className="size-2.5 shrink-0" strokeWidth={2.5} /> : <Play className="size-2.5 shrink-0" strokeWidth={2.5} />}
              <span className="truncate">{t.title}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={rowRef} className={cn("space-y-1", className)} data-previews="full">
      <ul className="list-none space-y-0.5">
        {tracks.map((t) => {
          const current = nowId === t.id;
          const on = current && playing;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => toggle(t)}
                aria-label={`${on ? "Pause" : "Play"} ${t.title}`}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors cursor-pointer",
                  current ? "bg-[#8c4a32]/8" : "hover:bg-[#f0e8de]",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                    on ? "border-[#8c4a32] bg-[#8c4a32] text-[#faf7f2]" : "border-[#d4c4b5] text-[#8c4a32] group-hover:border-[#8c4a32]",
                  )}
                >
                  {on ? <Pause className="size-3" strokeWidth={2.5} /> : <Play className="ml-px size-3" strokeWidth={2.5} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-[#1a1614]">{t.title}</span>
                  <span
                    className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-[#e8dfd6]"
                    aria-hidden
                  >
                    <span
                      className="block h-full bg-[#8c4a32] transition-[width] duration-200 ease-linear"
                      style={{ width: `${current ? Math.round(progress * 100) : 0}%` }}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-1.5 text-[10px] text-[#8a7f76]">30-second previews via Apple Music.</p>
    </div>
  );
}
