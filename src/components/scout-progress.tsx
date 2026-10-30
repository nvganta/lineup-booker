"use client";

import { ArtistPhoto } from "@/components/artist-photo";
import type {
  ArtistDataPart,
  PitchPayload,
  StepDataPart,
  StepKind,
} from "@/lib/agent/types";
import { readableTagLabels } from "@/lib/agent/step-copy";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

type Stage = { id: string; title: string; kinds: StepKind[]; role?: ArtistDataPart["role"] };

/** The scout's work in the order an owner would explain it. Each stage lights up from the agent's own steps. */
export const SCOUT_STAGES: Stage[] = [
  { id: "room", title: "Finding your room", kinds: ["venue"] },
  { id: "taste", title: "Reading what your regulars love", kinds: ["tags"] },
  { id: "headliner", title: "Sizing a headliner to your room", kinds: ["headliner"], role: "headliner" },
  { id: "opener", title: "Finding an opener their fans already like", kinds: ["opener"], role: "opener" },
  { id: "map", title: "Mapping where the fans live", kinds: ["neighborhoods"] },
  { id: "crowd", title: "Checking who comes", kinds: ["crowd"] },
  { id: "research", title: "Looking up where the acts are from", kinds: ["research"] },
  { id: "pitch", title: "Writing up the night", kinds: ["pitch", "quick"] },
];

type StageState = "pending" | "active" | "done";

function stageView(stage: Stage, steps: StepDataPart[]) {
  const mine = steps.filter((s) => stage.kinds.includes(s.kind) && !(s.kind === "pitch" && s.status === "fail"));
  const running = mine.some((s) => s.status === "running");
  const finished = mine.filter((s) => s.status !== "running");
  const last = finished[finished.length - 1];
  const state: StageState = running ? "active" : last ? "done" : "pending";
  return { state, finding: last?.label, weak: last?.status === "weak" || last?.status === "fail" };
}

/** Steps a saved example run would have produced, so the replay shows real findings. */
export function replayStepsFor(pitch: PitchPayload): StepDataPart[] {
  const meta = pitch.meta ?? {};
  const styles = readableTagLabels(meta.tagLabels ?? []).slice(0, 2);
  const rank = meta.headlinerRankInPool;
  const pool = meta.headlinerPoolSize;
  const lines: Array<[StepKind, string | null]> = [
    ["venue", `Found your room near ${meta.cityLabel ?? pitch.address}.`],
    ["tags", styles.length ? `Your regulars lean ${styles.join(" and ")}.` : "Mapped your regulars to taste tags."],
    [
      "headliner",
      pool && rank && rank > 1
        ? `Picked ${pitch.headliner.name}, #${rank} of ${pool} acts for room fit.`
        : pool
          ? `${pitch.headliner.name} leads ${pool} acts that fit your room.`
          : `Locked ${pitch.headliner.name} for the poster.`,
    ],
    ["opener", pitch.opener ? `${meta.openerOriginMatchesCity ? "Local opener" : "Opener"}: ${pitch.opener.name}.` : null],
    ["neighborhoods", pitch.neighborhoods.length >= 2 ? `Ranked ${pitch.neighborhoods.length} neighborhoods to poster first.` : null],
    ["crowd", pitch.crowdDemographics ? "Age skew checked against nearby listeners." : null],
    ["research", pitch.headliner.background ? "Read artist bios from public sources." : null],
    ["pitch", "Pitch locked for the room."],
  ];
  return lines.flatMap(([kind, label], i) =>
    label ? [{ id: `replay-${i}`, kind, status: "done" as const, label }] : [],
  );
}

function useElapsed(running: boolean): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, Math.round((now - start) / 1000));
}

/** Title text with a slow light passing through it while the step is being worked on. */
function Shimmer({ children }: { children: string }) {
  return (
    <motion.span
      className="bg-clip-text text-transparent bg-[length:250%_100%] bg-[linear-gradient(90deg,#1a1614_0%,#1a1614_40%,#c9a593_50%,#1a1614_60%,#1a1614_100%)]"
      initial={{ backgroundPositionX: "100%" }}
      animate={{ backgroundPositionX: "-100%" }}
      transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
}

function Marker({ state, weak }: { state: StageState; weak: boolean }) {
  if (state === "done") {
    return (
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: EASE_OUT }}
        className={cn(
          "flex size-5 items-center justify-center rounded-full",
          weak ? "bg-[#e8dfd6] text-[#8a7f76]" : "bg-[#8c4a32] text-[#faf7f2]",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </motion.span>
    );
  }
  if (state === "active") {
    return (
      <span className="relative flex size-5 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-[#e8dfd6]" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#8c4a32] animate-spin" />
      </span>
    );
  }
  return (
    <span className="flex size-5 items-center justify-center">
      <span className="size-1.5 rounded-full bg-[#d4c4b5]" />
    </span>
  );
}

type Props = {
  steps: StepDataPart[];
  artists?: ArtistDataPart[];
  /** Venue name for the header. */
  venue: string;
  /** Every stage settles to done; the page is about to fade in. */
  finished?: boolean;
  /** A saved example run playing back, not a live scout. */
  replay?: boolean;
  className?: string;
};

/** What the scout is doing right now, step by step, while the night is being put together. */
export function ScoutProgress({ steps, artists = [], venue, finished, replay, className }: Props) {
  const elapsed = useElapsed(!finished && !replay);
  const views = SCOUT_STAGES.map((stage) => {
    const v = stageView(stage, steps);
    return finished && v.state !== "done" ? { ...v, state: "done" as const, skipped: v.state === "pending" } : { ...v, skipped: false };
  });
  // Between tool calls the model is thinking; show that on the next stage instead of going still.
  if (!finished && !views.some((v) => v.state === "active")) {
    const lastDone = views.map((v) => v.state).lastIndexOf("done");
    const next = views.findIndex((v, i) => i > lastDone && v.state === "pending");
    if (next >= 0) views[next] = { ...views[next]!, state: "active" };
  }
  const done = views.filter((v) => v.state === "done").length;

  const heading = finished
    ? "Your night is ready."
    : replay
      ? `Opening a saved scout of ${venue}`
      : `Scouting a night for ${venue}`;

  return (
    <div
      className={cn("rounded-lg border border-[#e8dfd6] bg-[#fcf9f5] px-5 py-5 sm:px-6", className)}
      aria-busy={!finished}
      aria-live="polite"
      data-scout-progress={finished ? "finished" : "running"}
    >
      <div className="flex items-baseline justify-between gap-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h2
            key={heading}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="font-display text-[1.6rem] leading-tight text-[#1a1614]"
          >
            {heading}
          </motion.h2>
        </AnimatePresence>
        {!replay && (
          <span className="shrink-0 tabular-nums text-[12px] text-[#8a7f76]">{elapsed}s</span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-[#6b5c52]">
        {replay
          ? "This room was scouted earlier. Here's what the scout found."
          : "Every pick comes from Qloo's taste data. Usually under a minute."}
      </p>

      <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-[#ece4da]">
        <motion.div
          className="h-full bg-[#8c4a32]"
          initial={false}
          animate={{ width: `${Math.max(4, (done / SCOUT_STAGES.length) * 100)}%` }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        />
      </div>

      <ol className="mt-5 list-none space-y-3.5">
        {SCOUT_STAGES.map((stage, i) => {
          const v = views[i]!;
          const artist = stage.role ? artists.find((a) => a.role === stage.role) : undefined;
          return (
            <li key={stage.id} className="flex gap-3" data-stage={stage.id} data-state={v.state}>
              <span className="pt-px">
                <Marker state={v.state} weak={v.weak || v.skipped} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[14px] leading-5 transition-colors duration-300",
                    v.state === "pending" ? "text-[#a89c92]" : "text-[#1a1614]",
                    v.state === "active" && "font-medium",
                  )}
                >
                  {v.state === "active" ? <Shimmer>{stage.title}</Shimmer> : stage.title}
                </p>
                <AnimatePresence initial={false}>
                  {v.finding && v.state === "done" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 pt-1 text-[12.5px] leading-snug text-[#6b5c52]">
                        {artist && (
                          <ArtistPhoto
                            name={artist.name}
                            imageUrl={artist.imageUrl}
                            rounded="full"
                            className="size-5 shrink-0 text-[8px]"
                          />
                        )}
                        <span className="line-clamp-2">{v.finding}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
