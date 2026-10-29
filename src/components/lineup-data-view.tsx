"use client";

import { readableTagLabels } from "@/lib/agent/step-copy";
import type { PitchAnalytics } from "@/lib/lineup/pitch-analytics";
import type { PitchPayload } from "@/lib/agent/types";
import { crowdAgeRows, crowdGenderLean } from "@/lib/lineup/crowd-display";
import { popularityBandFromConcept } from "@/lib/lineup/tiers";
import { cn } from "@/lib/utils";

type Props = {
  pitch: PitchPayload;
  analytics: PitchAnalytics | null;
  className?: string;
};

function Panel({
  title,
  question,
  children,
  note,
}: {
  title: string;
  question: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <p className="font-heading text-[16px] leading-tight text-[#1a1614]">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-[#6b5c52]">{question}</p>
      </div>
      {children}
      {note && <p className="text-[11px] leading-snug text-[#8a7f76]">{note}</p>}
    </section>
  );
}

type Dot = { id: string; name: string; reach: number; role: "headliner" | "opener" | "other" };

/** Every act on one 0–100 reach line, with the band that fits the room shaded. */
function RoomFit({ pitch }: { pitch: PitchPayload }) {
  const band = popularityBandFromConcept(pitch.meta?.concept?.trim() || pitch.venueLabel);
  const lo = Math.round((band.headlinerMin ?? 0) * 100);
  const hi = Math.round((band.headlinerMax ?? 1) * 100);
  const dots: Dot[] = [];
  const pct = (p?: number) => (p != null && Number.isFinite(p) ? Math.round(p * 100) : null);
  const h = pct(pitch.meta?.headlinerPopularity);
  if (h != null) dots.push({ id: pitch.headliner.id, name: pitch.headliner.name, reach: h, role: "headliner" });
  const o = pct(pitch.meta?.openerPopularity);
  if (pitch.opener && o != null) dots.push({ id: pitch.opener.id, name: pitch.opener.name, reach: o, role: "opener" });
  for (const q of pitch.openerSwapQueue ?? []) {
    const r = pct(q.popularity);
    if (r != null && !dots.some((d) => d.id === q.id)) dots.push({ id: q.id, name: q.name, reach: r, role: "other" });
  }
  if (dots.length === 0) return <p className="text-[12px] italic text-[#8a7f76]">No reach data for this run.</p>;
  const ordered = [...dots].sort((a, b) => b.reach - a.reach);

  return (
    <div className="space-y-2" data-chart="room-fit">
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#d4c4b5]" />
        <div
          className="absolute top-0 bottom-0 rounded-sm bg-[#8c4a32]/12 border-x border-[#8c4a32]/30"
          style={{ left: `${lo}%`, width: `${Math.max(1, hi - lo)}%` }}
          title={`Fits a ${band.seatCapacity ?? "small"}-cap room: ${lo} to ${hi}`}
        />
        {ordered.map((d) => (
          <span
            key={d.id}
            title={`${d.name}: ${d.reach}/100`}
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#faf7f2]",
              d.role === "headliner" && "size-4 bg-[#8c4a32] z-10",
              d.role === "opener" && "size-3.5 bg-[#1a1614] z-10",
              d.role === "other" && "size-2.5 bg-[#b9aa9c]",
            )}
            style={{ left: `${d.reach}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] text-[#8a7f76]">
        <span>Smaller acts</span>
        <span>Bigger acts</span>
      </div>
      <ul className="mt-1 space-y-1 list-none">
        {ordered.map((d) => {
          const inBand = d.reach >= lo && d.reach <= hi;
          return (
            <li key={d.id} className="flex items-center gap-2 text-[12.5px]">
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  d.role === "headliner" && "bg-[#8c4a32]",
                  d.role === "opener" && "bg-[#1a1614]",
                  d.role === "other" && "bg-[#b9aa9c]",
                )}
              />
              <span className="min-w-0 truncate text-[#1a1614]">{d.name}</span>
              <span className="text-[11px] text-[#8a7f76]">
                {d.role === "headliner" ? "headliner" : d.role === "opener" ? "opener" : "other opener"}
              </span>
              <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] tabular-nums text-[#6b5c52]">
                {d.reach}/100{d.role === "headliner" ? (inBand ? " · in range" : " · outside") : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ageOrder(label: string): number {
  const n = Number(label.match(/\d+/)?.[0] ?? 0);
  return /younger/i.test(label) ? n - 100 : n;
}

/** Each age band against the city's average listener: right is more, left is fewer. */
function CrowdChart({ demo, city }: { demo: NonNullable<PitchAnalytics["demographics"]>; city: string }) {
  const rows = crowdAgeRows(demo).sort((a, b) => ageOrder(a.label) - ageOrder(b.label));
  const max = Math.max(0.01, ...rows.map((r) => Math.abs(r.value)));
  const top = rows.reduce<(typeof rows)[number] | null>((t, r) => (r.value > (t?.value ?? 0) ? r : t), null);
  const lean = crowdGenderLean(demo.gender);
  if (rows.length === 0 && !lean) return <p className="text-[12px] italic text-[#8a7f76]">No crowd data for this run.</p>;

  return (
    <div className="space-y-2" data-chart="crowd">
      <div className="grid grid-cols-[4.5rem_1fr] gap-x-3 text-[10.5px] text-[#8a7f76]">
        <span />
        <div className="flex justify-between">
          <span>Fewer than average</span>
          <span>More than average</span>
        </div>
      </div>
      <ul className="list-none space-y-1.5">
        {rows.map((r) => {
          const w = (Math.abs(r.value) / max) * 50;
          const up = r.value >= 0;
          const isTop = top?.label === r.label;
          return (
            <li key={r.label} className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3">
              <span className={cn("text-[12.5px]", isTop ? "font-medium text-[#1a1614]" : "text-[#5c534d]")}>{r.label}</span>
              <div className="relative h-3" title={`${r.label}: ${up ? "+" : ""}${r.value.toFixed(2)} against the ${city} average`}>
                <div className="absolute inset-y-0 left-1/2 w-px bg-[#c4b5a8]" />
                <div
                  className={cn("absolute inset-y-0 rounded-sm", up ? (isTop ? "bg-[#8c4a32]" : "bg-[#8c4a32]/60") : "bg-[#cfc3b6]")}
                  style={up ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {lean && (
        <p className="pt-1 text-[12.5px] text-[#3d3530]">
          Leans <span className="font-medium">{lean}</span>.
          {top ? ` The biggest group over the ${city} average is ${top.label}.` : ""}
        </p>
      )}
    </div>
  );
}

export function LineupDataView({ pitch, analytics, className }: Props) {
  const city = pitch.meta?.cityLabel ?? "city";
  const capacity = popularityBandFromConcept(pitch.meta?.concept?.trim() || pitch.venueLabel).seatCapacity;
  const overlap = analytics?.openerOverlap?.label?.replace(/,\s*\d(?:\.\d+)?\s*$/, "").replace(/^Strongest shared taste:\s*/i, "");
  const venueTags = analytics?.venueTags ?? [];

  return (
    <div className={cn("px-5 py-5 grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8 text-sm", className)}>
      <Panel
        title="Sized for your room"
        question="Where each act sits on Qloo's listener-reach scale."
        note={`The shaded band is the reach that fits a ${capacity ? `${capacity}-cap` : "small"} room: big enough to draw, small enough to book.`}
      >
        <RoomFit pitch={pitch} />
      </Panel>

      <Panel
        title="Who comes"
        question={`${pitch.headliner.name} fans by age, against the average ${city} listener.`}
        note="From Qloo's audience data for the headliner's fans."
      >
        {analytics?.demographics ? (
          <CrowdChart demo={analytics.demographics} city={city} />
        ) : (
          <p className="text-[12px] italic text-[#8a7f76]">Reading the crowd…</p>
        )}
      </Panel>

      {pitch.opener && overlap && (
        <Panel
          title="Why the two acts work together"
          question={`What ${pitch.headliner.name} and ${pitch.opener.name} fans have in common, from Qloo's taste comparison.`}
        >
          <p className="rounded-md border border-[#e8dfd6] bg-[#fcf9f5] px-4 py-3 text-[13.5px] text-[#1a1614]">
            Both crowds lean <span className="font-medium text-[#8c4a32]">{overlap.toLowerCase()}</span>, so the
            opener&apos;s fans are likely to stay for the headliner.
          </p>
        </Panel>
      )}

      {venueTags.length > 0 && (
        <Panel title="Your room in Qloo's words" question="The taste tags your concept and regulars matched.">
          <ul className="flex flex-wrap gap-2 list-none">
            {venueTags.slice(0, 6).map((t) => (
              <li
                key={t.id}
                className="rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-2.5 py-1 text-[12px] text-[#1a1614]"
                title={t.source === "regulars" ? "From what regulars love" : "From your concept"}
              >
                {readableTagLabels([t.name])[0] ?? t.name}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
