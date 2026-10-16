/** Primary agent model (override with AGENT_MODEL). */
export function agentModelId(): string {
  return process.env.AGENT_MODEL?.trim() || "openai/gpt-6-luna";
}

export function agentFallbackModelIds(): string[] {
  const raw =
    process.env.AGENT_FALLBACK_MODELS?.trim() ||
    "anthropic/claude-haiku-5.5";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const AGENT_TEMPERATURE = 0;
