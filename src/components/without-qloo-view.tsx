"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { PitchPayload } from "@/lib/agent/types";
import { markAgainstQloo } from "@/lib/compare/qloo-overlap";
import type { Mark, PlainForm, PlainResult } from "@/lib/compare/without-qloo";
import { ArtistPhoto } from "@/components/artist-photo";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import { ENTER, INDICATOR } from "@/lib/motion";
import type { SampleRun } from "@/lib/sample-runs";
import { cn } from "@/lib/utils";
import { Muted, POSTER_ARTICLE_CLASS, SourceNote } from "@/components/venue-tab-parts";

const memo = new Map<string, PlainResult>();

/** Saved example rooms answer instantly: no model call, no Qloo call. */
export function rememberPlainAnswer(run: SampleRun): void {
  const m = run.pitch.meta;
  memo.set(JSON.stringify({ concept: m?.concept?.trim() || run.pitch.venueLabel, address: run.pitch.address, regulars: m?.regularsLove?.trim() || "" }), run.plain);
}

type State = { status: "loading" } | { status: "ready"; result: PlainResult } | { status: "error" };

function usePlainAnswer(form: PlainForm): State {
  const key = JSON.stringify(form);
  const [, bump] = useState(0);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  useEffect(() => {
    if (memo.has(key)) return;
    let live = true;
    fetch("/api/without-qloo", { method: "POST", headers: { "Content-Type": "application/json" }, body: key })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        memo.set(key, (await r.json()) as PlainResult);
        if (live) bump((n) => n + 1);
      })
      .catch(() => live && setFailedKey(key));
    return () => {
      live = false;
    };
  }, [key]);
  const result = memo.get(key);
  if (result) return { status: "ready", result };
  return failedKey === key ? { status: "error" } : { status: "loading" };
}

function MarkLine({ m, delay = 0 }: { m: Mark; delay?: number }) {
  return (
    <motion.p
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...ENTER, delay }}
      className={cn("flex gap-1.5 text-[12px] leading-[1.35] mt-[3px]", m.ok ? "text-[#4f6b4a]" : "text-[#a3402a]")}
      data-mark={m.ok ? "ok" : "wrong"}
    >
      <span className={m.ok ? "" : "font-semibold"}>{m.ok ? "✓" : "✕"}</span>
      {m.text}
    </motion.p>
  );
}

function Act({ role, name, line, imageUrl, quote, marks = [], delay = 0 }: { role: string; name: string; line?: string | null; imageUrl?: string; quote?: boolean; marks?: Mark[]; delay?: number }) {
  return (
    <section className="px-5 py-3 border-b border-[#e8dfd6] flex gap-3 items-start">
      <ArtistPhoto name={name} imageUrl={imageUrl ?? ""} rounded="full" className="h-11 w-11 text-sm shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">{role}</p>
        <p className="font-heading text-[20px] leading-[1.15]">{name}</p>
        {line && <p className="text-[12px] leading-[1.4] text-[#5c534d] mt-0.5">{quote ? `"${line}"` : line}</p>}
        {marks.map((m, i) => (
          <MarkLine key={m.text} m={m} delay={delay + i * 0.06} />
        ))}
      </div>
    </section>
  );
}

function HoodMark({ m, delay }: { m: Mark; delay: number }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...ENTER, delay }}
      className={cn("ml-1.5 text-[11px]", m.ok ? "text-[#4f6b4a]" : m.soft ? "text-[#8a7f76]" : "text-[#a3402a]")}
      data-mark={m.ok ? "ok" : m.soft ? "soft" : "wrong"}
    >
      {m.ok ? `✓ ${m.text}` : m.soft ? m.text : `✕ ${m.text}`}
    </motion.span>
  );
}

function Hoods({ names, marks, delay = 0 }: { names: string[]; marks?: Array<Mark | null>; delay?: number }) {
  return (
    <section className="px-5 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#6b5c52] mb-2">Where to poster</p>
      <ol className="list-none space-y-[3px]">
        {names.map((n, i) => (
          <li key={n} className="text-[13px] leading-[1.35]">
            <span className="font-heading text-[15px] text-[#8c4a32] mr-1.5">{i + 1}</span>
            {n}
            {marks?.[i] && <HoodMark m={marks[i]!} delay={delay + i * 0.05} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Head({ title, aside }: { title: string; aside?: string }) {
  return (
    <header className="px-5 pt-3 pb-2.5 border-b border-[#e0d5ca] flex items-baseline justify-between gap-3">
      <p className="font-heading text-[20px] leading-[1.15]">{title}</p>
      {aside && <span className="text-[11px] text-[#8a7f76]">{aside}</span>}
    </header>
  );
}

function PlainSkeleton() {
  return (
    <div className="px-5 py-4 space-y-4" aria-busy="true">
      <p className="text-[12px] italic text-[#8a7f76]">Asking the model with no Qloo data…</p>
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3 items-center">
          <span className="h-11 w-11 rounded-full bg-[#ebe2d8] animate-pulse" />
          <span className="space-y-1.5 flex-1">
            <span className="block h-2 w-16 rounded bg-[#ebe2d8] animate-pulse" />
            <span className="block h-3.5 w-36 rounded bg-[#ebe2d8] animate-pulse" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** One line a judge can read before the columns: how the plain answer held up. */
function Tally({ marks }: { marks: Mark[] }) {
  const miss = marks.filter((m) => !m.ok && !m.soft).length;
  const offMap = marks.filter((m) => m.soft).length;
  const hit = marks.filter((m) => m.ok).length;
  if (miss + offMap + hit === 0) return null;
  const parts = [
    miss > 0 && `${miss} ${miss === 1 ? "pick fails" : "picks fail"} a check`,
    offMap > 0 && `${offMap} of its poster spots ${offMap === 1 ? "isn't" : "aren't"} in Qloo's top five`,
    hit > 0 && `${hit} ${hit === 1 ? "matches" : "match"} Qloo`,
  ].filter(Boolean);
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={ENTER}
      className="mb-2.5 mx-0.5 text-[13px] leading-[1.45] text-[#5c534d]"
      data-compare-tally
    >
      <span className="font-heading text-[16px] text-[#1a1614] mr-1.5">Without Qloo,</span>
      {parts.join(", ")}.
    </motion.p>
  );
}

type Props = {
  pitch: PitchPayload;
  venueCity?: string;
  form: PlainForm;
  headlinerLine?: string | null;
  openerLine?: string | null;
};

export function WithoutQlooView({ pitch, venueCity, form, headlinerLine, openerLine }: Props) {
  const state = usePlainAnswer(form);
  const qlooHoods = pitch.neighborhoods.slice(0, 5).map((n) => ({ ...n, name: stripCityFromNeighborhoodLabel(n.name, venueCity ?? "") }));
  const plain = state.status === "ready" ? state.result : null;
  // A server ✕ (a street, another city) outranks the Qloo overlap check.
  const hoodMarks = plain?.answer.neighbourhoods.map((n, i) => plain.marks.neighbourhoods[i] ?? markAgainstQloo(n, plain.points?.[i] ?? null, qlooHoods)) ?? [];
  const allMarks = plain ? [...plain.marks.headliner, ...plain.marks.opener, ...hoodMarks.filter((m): m is Mark => m != null)] : [];

  return (
    // Sized by the result pane, not the window: the pane is narrow beside the form.
    <div data-compare-view className="@container">
      {plain && <Tally marks={allMarks} />}
      <div className="grid grid-cols-1 @xl:grid-cols-2 gap-3.5 items-stretch">
        <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={ENTER} className={cn(POSTER_ARTICLE_CLASS, "max-w-none")} data-compare="qloo">
          <Head title="With Qloo" />
          <Act role="Headliner" name={pitch.headliner.name} line={headlinerLine} imageUrl={pitch.headliner.imageUrl} />
          {pitch.opener && <Act role="Opener" name={pitch.opener.name} line={openerLine} imageUrl={pitch.opener.imageUrl} />}
          {qlooHoods.length > 0 && <Hoods names={qlooHoods.map((h) => h.name)} />}
        </motion.article>
        <motion.article
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...ENTER, delay: 0.06 }}
          layout="size"
          className={cn(POSTER_ARTICLE_CLASS, "max-w-none overflow-hidden")}
          data-compare="plain"
        >
          <Head title="Without Qloo" aside="Model only, no Qloo data" />
          {state.status === "loading" ? (
            <PlainSkeleton />
          ) : state.status === "error" ? (
            <div className="px-5 py-4">
              <Muted>The model didn&apos;t answer this time.</Muted>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={ENTER}>
              <Act role="Headliner" name={state.result.answer.headliner.name} line={state.result.answer.headliner.why} quote imageUrl={state.result.headlinerImageUrl} marks={state.result.marks.headliner} delay={0.12} />
              {state.result.answer.opener && (
                <Act role="Opener" name={state.result.answer.opener.name} line={state.result.answer.opener.why} quote marks={state.result.marks.opener} delay={0.18} />
              )}
              {state.result.answer.neighbourhoods.length > 0 && <Hoods names={state.result.answer.neighbourhoods} marks={hoodMarks} delay={0.24} />}
            </motion.div>
          )}
        </motion.article>
      </div>
      <SourceNote className="mt-2.5 mx-0.5">
        Room size and poster spots are checked against Qloo. Hometowns come from Wikipedia and MusicBrainz, streets from OpenStreetMap. Unmarked lines weren&apos;t checked.
      </SourceNote>
    </div>
  );
}

export function CompareSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div role="group" aria-label="Compare" className="inline-flex rounded-full border border-[#e0d5ca] bg-[#fbf8f3] p-0.5 text-[11px] tracking-[0.06em]" data-poster-exclude="true">
      {(["With Qloo", "Without Qloo"] as const).map((t, i) => {
        const active = (i === 1) === on;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            data-compare-toggle={i === 1 ? "plain" : "qloo"}
            onClick={() => onChange(i === 1)}
            className={cn(
              "relative rounded-full px-2.5 py-1 cursor-pointer transition-colors duration-200 active:scale-[0.97] [transition-property:color,transform]",
              active ? "text-white" : "text-[#6b5c52] hover:text-[#1a1614]",
            )}
          >
            {active && <motion.span layoutId="compare-pill" transition={INDICATOR} className="absolute inset-0 rounded-full bg-[#8c4a32]" aria-hidden />}
            <span className="relative">{t}</span>
          </button>
        );
      })}
    </div>
  );
}
