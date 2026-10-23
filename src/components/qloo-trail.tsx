"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { TrailNode } from "@/lib/qloo/trail";
import { describeReceipt } from "@/lib/qloo/receipt-copy";
import type { QlooReceipt } from "@/lib/qloo/receipts";
import { ENTER } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Parameters worth a chip; the rest stay in the full request below each line. */
const SHOWN =
  /^(signal\.|filter\.(type|tags|popularity|results|location\.query|query|tag\.types)|output\.heatmap|operator\.|a\.signal|b\.signal|query$|feature\.)/;

function Receipt({
  r,
  names,
  n,
}: {
  r: QlooReceipt;
  names: Map<string, string>;
  n: number;
}) {
  const line = describeReceipt(r, names);
  return (
    <li className="flex gap-2.5">
      <span className="w-4 shrink-0 text-right font-heading text-[12px] leading-[1.5] text-[#8c4a32] tabular-nums">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[12.5px] leading-[1.35] text-[#1a1614]">
            {line.title}
          </p>
          <span className="shrink-0 text-[10.5px] text-[#8a7f76] tabular-nums">
            {r.results} {r.results === 1 ? "result" : "results"}
            {r.cached ? " · cached" : " · live"}
          </span>
        </div>
        <p className="mt-1 flex flex-wrap gap-1">
          {line.params
            .filter(([k]) => SHOWN.test(k))
            .map(([k, v]) => (
              <code
                key={k}
                className="max-w-full truncate rounded-sm bg-[#efe7dd] px-1.5 py-[1px] font-mono text-[10px] text-[#5c534d]"
                title={`${k}=${v}`}
              >
                {k}=<span className="text-[#1a1614]">{v}</span>
              </code>
            ))}
        </p>
        <details className="group mt-1">
          <summary className="cursor-pointer list-none text-[10.5px] text-[#8a7f76] hover:text-[#8c4a32] transition-colors">
            <span className="group-open:hidden">Show request</span>
            <span className="hidden group-open:inline">Hide request</span>
          </summary>
          <pre className="mt-1 whitespace-pre-wrap break-all rounded-sm bg-[#1a1614] px-3 py-2 font-mono text-[10px] leading-[1.5] text-[#efe7dd]">
            {line.request}
          </pre>
        </details>
      </div>
    </li>
  );
}

type Props = {
  nodes: TrailNode[];
  names: Map<string, string>;
  className?: string;
};

/** Room to lineup as a path. Hover a stop to see the Qloo requests behind it; click to keep it open. */
export function QlooTrail({ nodes, names, className }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const open = pinned ?? hovered;
  // Receipt numbers run across the whole trail, so "7" means the seventh call.
  const offsets = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const node of nodes) {
      m.set(node.id, n);
      n += node.receipts.length;
    }
    return m;
  }, [nodes]);
  const total = nodes.reduce((s, n) => s + n.receipts.length, 0);
  const live = nodes.reduce(
    (s, n) => s + n.receipts.filter((r) => !r.cached).length,
    0,
  );

  return (
    <div className={cn("relative", className)} data-qloo-trail>
      <p className="mb-3 text-[12px] text-[#6b5c52]">
        {total} Qloo requests, {live} live and {total - live} from cache. Hover
        a stop to see them.
      </p>
      <ol className="relative list-none space-y-2 pl-7 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-px before:bg-[#d4c4b5]">
        {nodes.map((node) => {
          const isOpen = open === node.id;
          const has = node.receipts.length > 0;
          return (
            <li key={node.id} className="relative" data-trail-stop={node.id}>
              <span
                aria-hidden
                className={cn(
                  "absolute -left-7 top-4 flex size-[22px] items-center justify-center rounded-full border-2 border-[#faf7f2] text-[10px] font-semibold transition-colors",
                  isOpen
                    ? "bg-[#1a1614] text-[#faf7f2]"
                    : has
                      ? "bg-[#8c4a32] text-[#faf7f2]"
                      : "bg-[#d4c4b5] text-[#1a1614]",
                )}
              >
                {has ? node.receipts.length : ""}
              </span>
              <div
                role={has ? "button" : undefined}
                tabIndex={has ? 0 : undefined}
                aria-expanded={has ? isOpen : undefined}
                onMouseEnter={() => has && setHovered(node.id)}
                onMouseLeave={() =>
                  setHovered((h) => (h === node.id ? null : h))
                }
                onFocus={() => has && setHovered(node.id)}
                onClick={() =>
                  has && setPinned((p) => (p === node.id ? null : node.id))
                }
                onKeyDown={(e) => {
                  if (has && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setPinned((p) => (p === node.id ? null : node.id));
                  }
                }}
                className={cn(
                  "rounded-md border bg-[#fcf9f5] px-4 py-3 transition-colors",
                  has && "cursor-pointer",
                  isOpen
                    ? "border-[#8c4a32]/50"
                    : "border-[#e8dfd6] hover:border-[#d4c4b5]",
                )}
              >
                <div className="flex items-baseline gap-3">
                  <p className="font-heading text-[18px] leading-none text-[#1a1614] tabular-nums shrink-0">
                    {node.stat}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8c4a32]">
                    {node.title}
                  </p>
                  {pinned === node.id && (
                    <span className="ml-auto text-[10px] text-[#8a7f76]">
                      pinned
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.45] text-[#3d3530]">
                  {node.line}
                </p>
                <AnimatePresence initial={false}>
                  {isOpen && has && (
                    <motion.div
                      key="receipts"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={ENTER}
                      className="overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ol className="mt-3 list-none space-y-2.5 border-t border-[#e8dfd6] pt-3">
                        {node.receipts.map((r, i) => (
                          <Receipt
                            key={`${r.path}-${i}`}
                            r={r}
                            names={names}
                            n={(offsets.get(node.id) ?? 0) + i + 1}
                          />
                        ))}
                      </ol>
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
