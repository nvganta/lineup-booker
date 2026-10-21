"use client";

import { readableTagLabels } from "@/lib/agent/step-copy";
import { CrowdSkewBars } from "@/components/crowd-skew-bars";
import { QlooReceipts } from "@/components/qloo-receipts";
import type { PitchAnalytics } from "@/lib/lineup/pitch-analytics";
import type { PitchPayload } from "@/lib/agent/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

type Props = {
  pitch: PitchPayload;
  analytics: PitchAnalytics | null;
  className?: string;
};

function na(label = "not available") {
  return (
    <p className="text-sm text-[#8a7f76] italic">{label}</p>
  );
}

export function LineupDataView({
  pitch,
  analytics,
  className,
}: Props) {
  const actRows =
    analytics?.acts.filter(
      (a) =>
        a.id === pitch.headliner.id ||
        a.id === pitch.opener?.id ||
        pitch.alternates.some((b) => b.id === a.id),
    ) ?? [];

  const barData = actRows
    .filter(
      (a) =>
        a.id === pitch.headliner.id || a.id === pitch.opener?.id,
    )
    .map((a) => ({
      name: a.name.length > 14 ? `${a.name.slice(0, 13)}…` : a.name,
      local: a.localAffinity,
      national: a.nationalAffinity,
    }));

  const overlap = analytics?.openerOverlap;
  const overlapVal = overlap?.value;

  return (
    <div className={cn("px-5 py-5 space-y-6 text-sm", className)}>
      <QlooReceipts pitch={pitch} analytics={analytics} />
      <section className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
          Local vs national
        </p>
        <p className="flex gap-3 text-[11px] text-[#6b5c52]">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-[6px] w-2.5 bg-[#8c4a32]" />Local</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-[6px] w-2.5 bg-[#c4b5a8]" />National</span>
        </p>
        {barData.length > 0 &&
        barData.some((d) => d.local != null || d.national != null) ? (
          <div className="h-[180px] w-full max-w-[480px]">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid stroke="#e8dfd6" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#6b5c52", fontSize: 11 }}
                axisLine={{ stroke: "#e0d5ca" }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: "#8a7f76", fontSize: 10 }}
                axisLine={{ stroke: "#e0d5ca" }}
              />
              <Bar dataKey="local" fill="#8c4a32" name="Local" radius={2} />
              <Bar
                dataKey="national"
                fill="#c4b5a8"
                name="National"
                radius={2}
              />
            </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          na()
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
          Opener overlap
        </p>
        {overlapVal != null ? (
          <div className="flex items-center gap-6">
            <OverlapCircles value={overlapVal} />
            <p className="text-xs text-[#5c534d] max-w-[14rem] leading-snug">
              {overlap?.label?.replace(/,\s*\d(?:\.\d+)?\s*$/, "")}
            </p>
          </div>
        ) : (
          na()
        )}
      </section>


      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
          Venue tags
        </p>
        {analytics?.venueTags && analytics.venueTags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 list-none">
            {analytics.venueTags.slice(0, 6).map((t) => (
              <li
                key={t.id}
                className="rounded-full border border-[#e0d5ca] px-2.5 py-0.5 text-xs text-[#1a1614] bg-[#fcf9f5]"
              >
                {readableTagLabels([t.name])[0] ?? t.name}
              </li>
            ))}
          </ul>
        ) : (
          na()
        )}
      </section>

      {analytics?.demographics &&
        (analytics.demographics.age || analytics.demographics.gender) && (
          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6b5c52]">
              Crowd
            </p>
            <CrowdSkewBars demographics={analytics.demographics} />
          </section>
        )}
    </div>
  );
}

function OverlapCircles({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 36;
  const overlapPx = pct * r * 0.85;
  return (
    <svg width={120} height={80} aria-hidden className="shrink-0">
      <circle cx={40} cy={40} r={r} fill="#8c4a32" fillOpacity={0.35} />
      <circle
        cx={40 + overlapPx}
        cy={40}
        r={r}
        fill="#8c4a32"
        fillOpacity={0.55}
      />
      <text
        x={60}
        y={44}
        textAnchor="middle"
        className="fill-[#1a1614] text-[11px] font-medium"
      >
        {pct.toFixed(2)}
      </text>
    </svg>
  );
}
