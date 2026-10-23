/**
 * Capture a saved run for an example room: the agent's pitch and venue pin,
 * the plain (no Qloo) answer, and the analytics, in the SampleRun shape the
 * app reads from SAMPLE_RUNS_JSON.
 *
 * Usage: npx tsx scripts/capture-sample-run.ts <out.json> [http://127.0.0.1:3000]
 * Writes { "<address>": SampleRun, ... } for every example room without
 * `--only <word>`; merge into the env var with scripts/merge-sample-runs.ts.
 */
import { writeFileSync } from "node:fs";
import { EXAMPLE_VENUES } from "../src/lib/example-venues";

type Chunk = { type?: string; data?: unknown };

const out = process.argv[2];
const base = process.argv[3] ?? "http://127.0.0.1:3000";
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]?.toLowerCase()
  : undefined;
if (!out) {
  console.error("usage: capture-sample-run.ts <out.json> [base] [--only word]");
  process.exit(1);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status} ${(await res.text()).slice(0, 120)}`);
  return (await res.json()) as T;
}

async function scout(request: { concept: string; location: string; regularsLove: string }) {
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok || !res.body) throw new Error(`/api/agent ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let pitch: Record<string, unknown> | undefined;
  let venue: { lat: number; lon: number } | undefined;
  let quick = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      let json: unknown;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      for (const c of (Array.isArray(json) ? json : [json]) as Chunk[]) {
        if (c.type === "data-pitch") pitch = c.data as Record<string, unknown>;
        if (c.type === "data-map") venue = (c.data as { venue: { lat: number; lon: number } }).venue;
        if (c.type === "data-summary") quick = Boolean((c.data as { quickMode?: boolean }).quickMode);
      }
    }
  }
  if (!pitch) throw new Error("no pitch");
  return { pitch, venue, quick };
}

async function main() {
  const runs: Record<string, unknown> = {};
  for (const ex of EXAMPLE_VENUES) {
    if (only && !ex.label.toLowerCase().includes(only)) continue;
    const r = ex.request;
    console.log(`→ ${ex.label}`);
    const { pitch, venue, quick } = await scout(r);
    const p = pitch as {
      headliner: { id: string; name: string };
      opener: { id: string; name: string } | null;
      alternates: Array<{ id: string; name: string }>;
      venueLabel: string;
      address: string;
      meta?: Record<string, unknown>;
      crowdDemographics?: unknown;
    };
    console.log(`  ${p.headliner.name} with ${p.opener?.name ?? "no opener"}${quick ? " (quick mode)" : ""}`);
    if (quick) console.log("  quick mode: rerun for a scouted pitch before saving");
    const meta = (p.meta ?? {}) as Record<string, unknown>;
    const cityQuery = (meta.cityQuery as string) ?? (meta.cityLabel as string);
    const plain = await post("/api/without-qloo", {
      concept: (meta.concept as string)?.trim() || p.venueLabel,
      address: p.address,
      regulars: (meta.regularsLove as string)?.trim() || "",
    });
    console.log("  plain answer ok");
    const { analytics } = await post<{ analytics: unknown }>("/api/pitch-analytics", {
      cityQuery,
      countryQuery: meta.countryQuery ?? "Canada",
      cityLabel: meta.cityLabel ?? cityQuery,
      concept: meta.concept ?? "",
      regularsLove: meta.regularsLove ?? "",
      musicTagIds: meta.musicTagIds ?? [],
      headliner: p.headliner,
      opener: p.opener,
      bench: p.alternates.map((a) => ({ id: a.id, name: a.name })),
      openerOriginMatchesCity: meta.openerOriginMatchesCity,
      headlinerPoolSize: meta.headlinerPoolSize,
      headlinerRankInPool: meta.headlinerRankInPool,
      headlinerPopularity: meta.headlinerPopularity,
      openerPopularity: meta.openerPopularity,
      tagLabels: meta.tagLabels,
      crowdDemographics: p.crowdDemographics ?? null,
    });
    console.log("  analytics ok");
    runs[r.location] = {
      savedAt: new Date().toISOString(),
      pitch,
      venue: venue ?? null,
      plain,
      analytics,
    };
  }
  writeFileSync(out, JSON.stringify(runs));
  console.log(`wrote ${Object.keys(runs).length} run(s) to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
