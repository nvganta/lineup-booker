/**
 * Free gateway models, best first. Checked against the gateway's model list
 * (tool use, zero price) in October 2026.
 */
export const FREE_MODEL_CHAIN = [
  "nvidia/nemotron-3.5-lightning-free",
  "minimax/minimax-m3.1-flash",
  "poolside/laguna-s-2.1-free",
];

/** Primary agent model (override with AGENT_MODEL). */
export function agentModelId(): string {
  return process.env.AGENT_MODEL?.trim() || FREE_MODEL_CHAIN[0]!;
}

export function agentFallbackModelIds(): string[] {
  const raw = process.env.AGENT_FALLBACK_MODELS?.trim() || FREE_MODEL_CHAIN.slice(1).join(",");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const AGENT_TEMPERATURE = 0;

type GatewayModel = { id: string; type?: string; pricing?: { input?: string; output?: string } };

const MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
const LIST_TTL_MS = 10 * 60 * 1000;
let listCache: { at: number; free: Set<string> } | null = null;

/** Ids the gateway lists as language models with a zero input and output price. */
export function freeLanguageModels(list: GatewayModel[]): Set<string> {
  return new Set(
    list
      .filter(
        (m) =>
          (m.type ?? "language") === "language" &&
          Number(m.pricing?.input ?? NaN) === 0 &&
          Number(m.pricing?.output ?? NaN) === 0,
      )
      .map((m) => m.id),
  );
}

/** Env models first, then the built-in free chain, with no repeats. */
export function candidateModelIds(): string[] {
  return [...new Set([agentModelId(), ...agentFallbackModelIds(), ...FREE_MODEL_CHAIN])];
}

/**
 * The models to try, in order. A model the gateway no longer lists, or one
 * that isn't free, is dropped up front so a retired id costs no request.
 * If the list can't be read, the candidates are tried as they are and the
 * caller's rotation skips any that fail.
 */
export async function agentModelChain(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const candidates = candidateModelIds();
  try {
    if (!listCache || Date.now() - listCache.at > LIST_TTL_MS) {
      const res = await fetchImpl(MODELS_URL, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`models ${res.status}`);
      const body = (await res.json()) as { data?: GatewayModel[] };
      listCache = { at: Date.now(), free: freeLanguageModels(body.data ?? []) };
    }
    const free = listCache.free;
    const chain = candidates.filter((m) => free.has(m));
    const dropped = candidates.filter((m) => !free.has(m));
    if (dropped.length > 0) console.warn(`[model] skipped unlisted or paid: ${dropped.join(", ")}`);
    return chain.length > 0 ? chain : FREE_MODEL_CHAIN.slice();
  } catch {
    return candidates;
  }
}

export function resetModelListCache(): void {
  listCache = null;
}
