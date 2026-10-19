"use client";

import { useEffect, useState } from "react";
import type { PitchPayload } from "@/lib/agent/types";
import type { Mark, PlainForm, PlainResult } from "@/lib/compare/without-qloo";
import { ArtistPhoto } from "@/components/artist-photo";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import { cn } from "@/lib/utils";
import { Muted, POSTER_ARTICLE_CLASS, SourceNote } from "@/components/venue-tab-parts";

const memo = new Map<string, PlainResult>();

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

function MarkLine({ m }: { m: Mark }) {
  return (
    <p className={cn("flex gap-1.5 text-[12px] leading-[1.35] mt-[3px]", m.ok ? "text-[#6b5c52]" : "text-[#a3402a]")} data-mark={m.ok ? "ok" : "wrong"}>
      <span className={m.ok ? "" : "font-semibold"}>{m.ok ? "✓" : "✕"}</span>
      {m.text}
    </p>
  );
}

function Act({ role, name, line, imageUrl, quote, marks = [] }: { role: string; name: string; line?: string | null; imageUrl?: string; quote?: boolean; marks?: Mark[] }) {
  return (
    <section className="px-5 py-3 border-b border-[#e8dfd6] flex gap-3 items-start">
      {imageUrl !== undefined ? (
        <ArtistPhoto name={name} imageUrl={imageUrl} rounded="full" className="h-11 w-11 text-sm shrink-0" />
      ) : (
        <span className="h-11 w-11 shrink-0 rounded-full bg-[#e8dfd6]" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">{role}</p>
        <p className="font-heading text-[20px] leading-[1.15]">{name}</p>
        {line && <p className="text-[12px] leading-[1.4] text-[#5c534d] mt-0.5">{quote ? `"${line}"` : line}</p>}
        {marks.map((m) => (
          <MarkLine key={m.text} m={m} />
        ))}
      </div>
    </section>
  );
}

function Hoods({ names, marks }: { names: string[]; marks?: Array<Mark | null> }) {
  return (
    <section className="px-5 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#6b5c52] mb-2">Where to poster</p>
      <ol className="list-none space-y-[3px]">
        {names.map((n, i) => (
          <li key={n} className="text-[13px] leading-[1.35]">
            <span className="font-heading text-[15px] text-[#8c4a32] mr-1.5">{i + 1}</span>
            {n}
            {marks?.[i] && !marks[i]!.ok && <span className="ml-1.5 text-[11px] text-[#a3402a]" data-mark="wrong">{marks[i]!.text}</span>}
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

type Props = {
  pitch: PitchPayload;
  venueCity?: string;
  form: PlainForm;
  headlinerLine?: string | null;
  openerLine?: string | null;
};

export function WithoutQlooView({ pitch, venueCity, form, headlinerLine, openerLine }: Props) {
  const state = usePlainAnswer(form);
  const hoods = pitch.neighborhoods.slice(0, 5).map((n) => stripCityFromNeighborhoodLabel(n.name, venueCity ?? ""));
  return (
    <div data-compare-view>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
        <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")} data-compare="qloo">
          <Head title="With Qloo" />
          <Act role="Headliner" name={pitch.headliner.name} line={headlinerLine} imageUrl={pitch.headliner.imageUrl ?? ""} />
          {pitch.opener && <Act role="Opener" name={pitch.opener.name} line={openerLine} imageUrl={pitch.opener.imageUrl ?? ""} />}
          {hoods.length > 0 && <Hoods names={hoods} />}
        </article>
        <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")} data-compare="plain">
          <Head title="Without Qloo" aside="Same model, form only" />
          {state.status === "loading" ? (
            <p className="px-5 py-6 text-[13px] italic text-[#8a7f76]" aria-busy="true">Asking the model without Qloo…</p>
          ) : state.status === "error" ? (
            <div className="px-5 py-4">
              <Muted>The model didn&apos;t answer this time.</Muted>
            </div>
          ) : (
            <>
              <Act role="Headliner" name={state.result.answer.headliner.name} line={state.result.answer.headliner.why} quote marks={state.result.marks.headliner} />
              {state.result.answer.opener && (
                <Act role="Opener" name={state.result.answer.opener.name} line={state.result.answer.opener.why} quote marks={state.result.marks.opener} />
              )}
              {state.result.answer.neighbourhoods.length > 0 && (
                <Hoods names={state.result.answer.neighbourhoods} marks={state.result.marks.neighbourhoods} />
              )}
            </>
          )}
        </article>
      </div>
      <SourceNote className="mt-2.5 mx-0.5">
        Marks come from Wikipedia, MusicBrainz and OpenStreetMap. Unmarked lines weren&apos;t checked.
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
            className={cn("rounded-full px-2.5 py-1 cursor-pointer", active ? "bg-[#8c4a32] text-white" : "text-[#6b5c52]")}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
