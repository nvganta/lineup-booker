/**
 * Agent eval — runs when QLOO_API_KEY and AI_GATEWAY_API_KEY (or Vercel OIDC) exist.
 * Usage: npx tsx scripts/agent-eval.ts
 */
import { validatePitchPayload } from "../src/lib/agent/pitch-validator";

const input = {
  concept: "Neighborhood bar 250 capacity",
  location: "100 Main St, Fixture City",
  regularsLove: "indie folk, soul",
};

async function main() {
  if (!process.env.QLOO_API_KEY) {
    console.log("Skip agent eval: QLOO_API_KEY not set.");
    process.exit(0);
  }
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) {
    console.log("Skip agent eval: AI Gateway not configured.");
    process.exit(0);
  }

  const qlooLookups: number[] = [];
  for (let run = 0; run < 5; run++) {
    const res = await fetch("http://127.0.0.1:3000/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("Run failed", run, await res.text());
      process.exit(1);
    }
    const text = await res.text();
    const summaryMatch = text.match(
      /"type":"data-summary"[^}]*"data":\{[^}]*"qlooLookups":(\d+)/,
    );
    qlooLookups.push(summaryMatch ? Number(summaryMatch[1]) : -1);
    if (text.includes("Zed Zeppelin")) {
      console.error("Hallucinated name detected");
      process.exit(1);
    }
  }

  console.log("agent-eval ok", { runs: 5, qlooLookups });
  void validatePitchPayload;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
