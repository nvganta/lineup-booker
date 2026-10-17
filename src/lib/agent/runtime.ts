import { AsyncLocalStorage } from "node:async_hooks";
import type { AgentBudget } from "./budget";
import type { LineupRequest } from "@/lib/lineup/schemas";
import type { AgentSessionState, StreamWriter } from "./types";

export type AgentRuntime = {
  budget: AgentBudget;
  session: AgentSessionState;
  writer: StreamWriter;
  retries: number;
  lineupRequest?: LineupRequest;
};

export const agentRuntimeStorage = new AsyncLocalStorage<AgentRuntime>();

export function getAgentRuntime(): AgentRuntime | undefined {
  return agentRuntimeStorage.getStore();
}

export function runWithAgentRuntime<T>(
  runtime: AgentRuntime,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(agentRuntimeStorage.run(runtime, fn));
}

export function createEmptySession(): AgentSessionState {
  return {
    tagIds: [],
    tagLabels: [],
    tagOperator: "intersection",
    neighborhoods: [],
    widenLevel: 0,
    refineUsed: new Set(),
    knownTagIds: new Set(),
    knownNames: new Set(),
    knownIds: new Set(),
  };
}

export function runOutsideAgentRuntime<T>(fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(agentRuntimeStorage.exit(fn));
}

/** Bench minus whoever ended up opening, so one act never shows twice. */
export function withoutOpener(
  session: AgentSessionState,
): NonNullable<AgentSessionState["alternateEntities"]> {
  const opener = session.openerEntity;
  return (session.alternateEntities ?? []).filter(
    (a) => !opener || (a.id !== opener.id && a.name !== opener.name),
  );
}
