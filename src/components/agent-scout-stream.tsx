"use client";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/components/ai-elements/task";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import type { AgentFinishSummary, StepDataPart } from "@/lib/agent/types";
import { stepBodyForDisplay } from "@/lib/agent/step-display";
import { visibleScoutSteps } from "@/lib/agent/scout-steps-display";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

const TOOL_KINDS = new Set<StepDataPart["kind"]>([
  "venue",
  "tags",
  "headliner",
  "opener",
  "neighborhoods",
  "crowd",
  "research",
]);

function stepStatus(
  status: StepDataPart["status"],
): "input-available" | "output-available" | "output-error" {
  if (status === "running") return "input-available";
  if (status === "fail") return "output-error";
  return "output-available";
}

type Props = {
  steps: StepDataPart[];
  summary?: AgentFinishSummary;
  collapsedDefault?: boolean;
  className?: string;
};

export function AgentScoutStream({
  steps,
  summary,
  collapsedDefault,
  className,
}: Props) {
  const done = Boolean(summary);
  const [open, setOpen] = useState(!collapsedDefault && !done);

  const live = useMemo(() => visibleScoutSteps(steps, done), [steps, done]);

  if (live.length === 0) return null;

  const body = (
    <div
      className={cn(
        "space-y-3 font-[family-name:var(--font-geist-sans)] text-[15px] text-[#5c534d]",
        "[&_.border]:border-[#e8dfd6] [&_.bg-secondary]:bg-[#f3ece4] [&_.text-muted-foreground]:text-[#6b5c52]",
      )}
    >
      {live.map((step) => {
        const bodyText = stepBodyForDisplay(step);
        const isTool = TOOL_KINDS.has(step.kind);
        if (isTool) {
          return (
            <motion.div key={step.id} {...fadeUp}>
              <Tool
                defaultOpen
                className="mb-0 border-[#e8dfd6] bg-[#fcf9f5] shadow-none rounded-sm"
              >
                <ToolHeader
                  type="dynamic-tool"
                  toolName={step.kind}
                  state={stepStatus(step.status)}
                  title={step.label}
                  className="font-[family-name:var(--font-heading)] text-[#1a1614] [&_svg]:text-[#8c4a32] [&_.rounded-full]:hidden"
                />
                {(step.detail || step.evidence) && (
                  <ToolContent className="text-xs text-[#8a7f76] border-t border-[#e8dfd6]">
                    {step.detail && <p>{step.detail}</p>}
                    {step.evidence && <p className="mt-1">{step.evidence}</p>}
                  </ToolContent>
                )}
              </Tool>
            </motion.div>
          );
        }
        return (
          <motion.div key={step.id} {...fadeUp}>
            <Task defaultOpen className="border-0 bg-transparent p-0">
              <TaskTrigger
                title={step.label}
                className="font-[family-name:var(--font-heading)] text-[#1a1614] [&_svg]:hidden pointer-events-none"
              />
              {bodyText && (
                <TaskContent className="pl-0">
                  <TaskItem className="text-[#5c534d]">{bodyText}</TaskItem>
                </TaskContent>
              )}
            </Task>
          </motion.div>
        );
      })}
    </div>
  );

  if (done) {
    return (
      <div className={cn("text-sm", className)}>
        <ChainOfThought open={open} onOpenChange={setOpen}>
          <ChainOfThoughtHeader className="font-[family-name:var(--font-heading)] text-[#1a1614] hover:text-[#8c4a32] [&_svg]:transition-none">
            How I got here
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            <ChainOfThoughtStep
              label="Scout trace"
              status="complete"
              className="border-[#e0d5ca] [&_[data-icon]]:text-[#8c4a32] animate-none"
            >
              {body}
            </ChainOfThoughtStep>
          </ChainOfThoughtContent>
        </ChainOfThought>
        {summary && (
          <p className="text-[#8a7f76] text-xs mt-2">
            Scouted in {summary.elapsedSec}s · {summary.qlooLookups} taste
            lookups
            {summary.retries ? ` · ${summary.retries} retry` : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#8c4a32]">
        Scout steps
      </p>
      {body}
    </div>
  );
}
