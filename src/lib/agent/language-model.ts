import { createGatewayProvider } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * The provider behind a model id. "openai/…" goes straight to OpenAI when an
 * OPENAI_API_KEY is set, billed to that key; everything else, the free
 * fallbacks included, goes through the Vercel AI Gateway.
 */
export function languageModel(modelId: string) {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey && modelId.startsWith("openai/")) {
    return createOpenAI({ apiKey: openaiKey })(modelId.slice("openai/".length));
  }
  return createGatewayProvider({ apiKey: process.env.AI_GATEWAY_API_KEY })(modelId);
}
