/**
 * Time the scout's first step on each model, so a model swap is a measured
 * choice. Tools keep their schemas but lose execute: nothing reaches Qloo.
 *
 *   npx tsx --env-file=.env.local scripts/bench-models.ts <model-id> [...]
 */
import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText, type ToolSet } from "ai";
import { buildAgentTools } from "@/lib/agent/tools";
import { AGENT_SYSTEM_PROMPT, agentUserPrompt } from "@/lib/agent/system-prompt";

const tools = Object.fromEntries(
  Object.entries(buildAgentTools()).map(([k, t]) => [k, { ...(t as object), execute: undefined }]),
) as ToolSet;
const gateway = createGatewayProvider({ apiKey: process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN });
const prompt = agentUserPrompt({ concept: "Natural wine and small plates cafe-bar, 300 capacity", location: "2509 Main St, Vancouver, BC", regularsLove: "Indie folk and vinyl nights" });
const models = process.argv.slice(2);

async function main() {
for (const id of models) {
  const times: number[] = [];
  let calls = "";
  let err = "";
  for (let i = 0; i < 2; i++) {
    const t0 = Date.now();
    try {
      const r = await generateText({
        model: gateway(id), system: AGENT_SYSTEM_PROMPT, prompt, tools, maxRetries: 0, temperature: 0,
        activeTools: ["locate_venue", "room_size_band", "find_music_tags"] as never,
        abortSignal: AbortSignal.timeout(40_000),
      });
      times.push(Date.now() - t0);
      calls = r.toolCalls.map((c) => c.toolName).join("+") || `(no tool calls: ${r.text.slice(0, 40)})`;
    } catch (e) {
      err = String(e instanceof Error ? e.message : e).slice(0, 90);
      times.push(Date.now() - t0);
    }
  }
  console.log(`${id.padEnd(42)} ${times.map((t) => (t / 1000).toFixed(1) + "s").join(" / ").padEnd(14)} ${err || calls}`);
}
}
main();
