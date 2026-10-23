/**
 * Merge captured runs into a SAMPLE_RUNS_JSON value.
 * Usage: npx tsx scripts/merge-sample-runs.ts <existing.env-or-json> <captured.json> <out.b64>
 * The first argument is a file holding either the raw env value (JSON or
 * base64) or a dotenv file with a SAMPLE_RUNS_JSON= line. Prints the rooms.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseSampleRuns } from "../src/lib/sample-runs";

const [existingPath, capturedPath, outPath] = process.argv.slice(2);
if (!existingPath || !capturedPath || !outPath) {
  console.error("usage: merge-sample-runs.ts <existing> <captured.json> <out.b64>");
  process.exit(1);
}

let existingRaw = readFileSync(existingPath, "utf8");
const envLine = existingRaw.split(/\r?\n/).find((l) => l.startsWith("SAMPLE_RUNS_JSON="));
if (envLine) existingRaw = envLine.slice("SAMPLE_RUNS_JSON=".length).replace(/^"|"$/g, "");
const existing = parseSampleRuns(existingRaw);
const captured = parseSampleRuns(readFileSync(capturedPath, "utf8"));
const merged = { ...existing, ...captured };
const b64 = Buffer.from(JSON.stringify(merged)).toString("base64");
writeFileSync(outPath, b64);
for (const [address, run] of Object.entries(merged)) {
  console.log(`${address}: ${run.pitch.headliner.name}${captured[address] ? " (new)" : ""}`);
}
console.log(`${Object.keys(merged).length} rooms, ${b64.length} chars base64, written to ${outPath}`);
