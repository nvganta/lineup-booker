"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import type { PitchPayload } from "@/lib/agent/types";
import type { PitchAnalytics } from "@/lib/lineup/pitch-analytics";
import { describeReceipt } from "@/lib/qloo/receipt-copy";
import type { QlooReceipt } from "@/lib/qloo/receipts";
import { ENTER } from "@/lib/motion";

/** Parameters worth a chip; the rest stay in the full request below each line. */
const SHOWN = /^(signal\.|filter\.(type|tags|popularity|results|location\.query|query|tag\.types)|output\.heatmap|operator\.|a\.signal|b\.signal|query$|feature\.)/;

function Group({ label, receipts, names, offset }: { label: string; receipts: QlooReceipt[]; names: Map<string, string>; offset: number }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#8a7f76]">{label}</p>
      <ol className="list-none space-y-2.5">
        {receipts.map((r, i) => {
          const line = describeReceipt(r, names);
          return (
            <motion.li
              key={`${line.request}-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ENTER, delay: Math.min(i, 10) * 0.035 }}
              className="flex gap-3"
            >
              <span className="font-heading text-[15px] leading-[1.3] text-[#8c4a32] tabular-nums w-5 shrink-0 text-right">{offset + i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] leading-[1.35] text-[#1a1614]">{line.title}</p>
                  <span className="shrink-0 text-[11px] text-[#8a7f76] tabular-nums">
                    {r.results} {r.results === 1 ? "result" : "results"}
                    {r.cached ? " · cached" : ""}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap gap-1">
                  {line.params
                    .filter(([k]) => SHOWN.test(k))
                    .map(([k, v]) => (
                      <code key={k} className="max-w-full truncate rounded-sm bg-[#efe7dd] px-1.5 py-[1px] font-mono text-[10.5px] text-[#5c534d]" title={`${k}=${v}`}>
                        {k}=<span className="text-[#1a1614]">{v}</span>
                      </code>
                    ))}
                </p>
                <details className="group mt-1">
                  <summary className="cursor-pointer list-none text-[11px] text-[#8a7f76] hover:text-[#8c4a32] transition-colors">
                    <span className="group-open:hidden">Show request</span>
                    <span className="hidden group-open:inline">Hide request</span>
                  </summary>
                  <pre className="mt-1 whitespace-pre-wrap break-all rounded-sm bg-[#1a1614] px-3 py-2 font-mono text-[10.5px] leading-[1.5] text-[#efe7dd]">{line.request}</pre>
                </details>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/** Every Qloo request behind this lineup, in plain words, with the parameters we chose. */
export function QlooReceipts({ pitch, analytics }: { pitch: PitchPayload; analytics: PitchAnalytics | null }) {
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of [pitch.headliner, pitch.opener, ...pitch.alternates, ...(pitch.openerSwapQueue ?? [])]) {
      if (a) m.set(a.id, a.name);
    }
    for (const a of analytics?.acts ?? []) m.set(a.id, a.name);
    return m;
  }, [pitch, analytics]);

  const scout = pitch.qlooCalls ?? [];
  const numbers = analytics?.qlooCalls ?? [];
  const all = [...scout, ...numbers];
  if (all.length === 0) return null;
  const live = all.filter((r) => !r.cached).length;

  return (
    <section className="space-y-4" data-qloo-receipts>
      <div>
        <p className="font-heading text-[20px] leading-[1.15] text-[#1a1614]">Qloo receipts</p>
        <p className="mt-0.5 text-[12px] text-[#6b5c52]">
          Every Qloo request behind this lineup: {all.length} in all, {live} live and {all.length - live} from cache.
        </p>
      </div>
      {scout.length > 0 && <Group label="Scouting the night" receipts={scout} names={names} offset={0} />}
      {numbers.length > 0 && <Group label="Reading the numbers" receipts={numbers} names={names} offset={scout.length} />}
    </section>
  );
}
