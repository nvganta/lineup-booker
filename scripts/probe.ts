/**
 * Debug pipeline — reads QLOO_API_KEY from env (never prints it).
 *
 * Usage:
 *   QLOO_API_KEY=... npx tsx scripts/probe.ts \
 *     --address "2509 Main St, Vancouver, BC" \
 *     --concept "Natural wine cafe-bar" \
 *     --regulars "Indie folk and vinyl nights"
 */
import { runProbe } from "../src/lib/lineup/probe-pipeline";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  return process.argv[i + 1]!;
}

async function main() {
  if (!process.env.QLOO_API_KEY) {
    console.error("Set QLOO_API_KEY in the environment.");
    process.exit(1);
  }

  const input = {
    concept: arg("--concept", "Natural wine and small plates cafe-bar"),
    location: arg("--address", "2509 Main St, Vancouver, BC"),
    regularsLove: arg("--regulars", "Indie folk and vinyl nights"),
  };

  const result = await runProbe(input);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
