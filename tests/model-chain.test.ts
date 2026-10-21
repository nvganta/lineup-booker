import { afterEach, describe, expect, it, vi } from "vitest";
import { agentModelChain, FREE_MODEL_CHAIN, freeLanguageModels, resetModelListCache } from "@/lib/agent/model";

const list = {
  data: [
    { id: "nvidia/nemotron-3.5-lightning-free", type: "language", pricing: { input: "0", output: "0" } },
    { id: "minimax/minimax-m3.1-flash", type: "language", pricing: { input: "0", output: "0" } },
    { id: "poolside/laguna-s-2.1-free", type: "language", pricing: { input: "0", output: "0" } },
    { id: "acme/paid-model", type: "language", pricing: { input: "0.000001", output: "0.000002" } },
    { id: "acme/free-image", type: "image", pricing: { input: "0", output: "0" } },
  ],
};

function fakeFetch(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;
}

afterEach(() => {
  resetModelListCache();
  vi.unstubAllEnvs();
});

describe("model chain", () => {
  it("keeps only free language models", () => {
    expect([...freeLanguageModels(list.data)]).toEqual(FREE_MODEL_CHAIN);
  });

  it("drops a retired env model and a paid fallback", async () => {
    vi.stubEnv("AGENT_MODEL", "stealth/retired");
    vi.stubEnv("AGENT_FALLBACK_MODELS", "acme/paid-model");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await agentModelChain(fakeFetch(list))).toEqual(FREE_MODEL_CHAIN);
  });

  it("reads the list once while cached", async () => {
    const f = fakeFetch(list);
    await agentModelChain(f);
    await agentModelChain(f);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("falls back to the candidates when the list can't be read", async () => {
    vi.stubEnv("AGENT_MODEL", "");
    const chain = await agentModelChain(fakeFetch({}, false));
    expect(chain[0]).toBe(FREE_MODEL_CHAIN[0]);
  });
});
