"use client";

import type { AgentFinishSummary, StepDataPart } from "@/lib/agent/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

function glyph(status: StepDataPart["status"]): string {
  switch (status) {
    case "running":
      return "◔";
    case "done":
      return "✓";
    case "weak":
      return "△";
    case "fail":
      return "×";
    default:
      return "·";
  }
}

type Props = {
  steps: StepDataPart[];
  summary?: AgentFinishSummary;
};

/** Collapse repeated tag steps into the latest line. */
function mergeTagSteps(steps: StepDataPart[]): StepDataPart[] {
  const tagSteps = steps.filter((s) => s.kind === "tags");
  if (tagSteps.length <= 1) return steps;
  const latestId = tagSteps[tagSteps.length - 1]!.id;
  return steps
    .filter((s) => s.kind !== "tags" || s.id === latestId)
    .map((s) => {
      if (s.kind !== "tags" || s.id !== latestId) return s;
      // "…plus N related styles." already says the search widened.
      return s;
    });
}

export function ScoutingLog({ steps, summary }: Props) {
  const [open, setOpen] = useState(false);
  const visible = steps.filter(
    (s) => s.kind !== "plan" || s.status !== "running",
  );
  // Rejected pitch drafts are part of the audit trail, not the live story.
  const live = mergeTagSteps(
    visible.filter((s) => !(s.kind === "pitch" && s.status === "fail")),
  );

  if (live.length === 0) return null;

  return (
    <aside className="max-w-xl text-[15px] text-[#5c534d] space-y-3 font-[family-name:var(--font-geist-sans)]">
      <div className="space-y-2.5 border-l border-[#e0d5ca] pl-4">
        {live.map((step) => (
          <div key={step.id} className="leading-snug">
            <div className="flex gap-2.5 items-start">
              <span
                className={cn(
                  "shrink-0 w-4 text-center text-sm pt-0.5",
                  step.status === "weak" && "text-[#b8860b]",
                  step.status === "fail" && "text-[#8c4a32]",
                )}
                aria-hidden
              >
                {glyph(step.status)}
              </span>
              <p
                className={cn(
                  "text-[#1a1614] min-w-0",
                  step.kind === "headliner" && "font-[family-name:var(--font-heading)] text-[1.05rem]",
                )}
              >
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {summary && (
        <div className="text-sm text-[#8a7f76]">
          <button
            type="button"
            className="underline-offset-2 hover:underline text-left"
            onClick={() => setOpen((v) => !v)}
          >
            Scouted in {summary.elapsedSec}s · {summary.qlooLookups} taste
            lookups
            {summary.retries ? ` · ${summary.retries} retry` : ""}
            {summary.quickMode ? " · Quick mode" : ""}{" "}
            <span className="text-[#8c4a32]">
              {open ? "▾" : "▸"} How I got here
            </span>
          </button>
          {open && (
            <ul className="mt-3 space-y-2 list-none pl-1 text-[13px]">
              {visible.map((s) => (
                <li key={`${s.id}-detail`} className="space-y-1">
                  <span className="text-[#1a1614]">{s.label}</span>
                  {s.why && (
                    <p className="text-[#8a7f76] italic">{s.why}</p>
                  )}
                  {s.evidence && (
                    <p className="inline-block rounded-full border border-[#e8dfd6] bg-[#fcf9f5] px-2 py-0.5 text-[11px] text-[#6b5c52]">
                      {s.evidence}
                    </p>
                  )}
                  {s.detail && (
                    <p className="text-[#8a7f76] text-xs">{s.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
