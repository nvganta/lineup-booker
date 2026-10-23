/**
 * Stranger test: rooms the app has never seen, typed the way a judge would,
 * run end to end against a local server and timed.
 * Usage: npx tsx scripts/stranger-test.ts [http://127.0.0.1:3000]
 */
type Chunk = { type?: string; data?: Record<string, unknown> };

const ROOMS = [
  { concept: "Taco bar with a back patio, 150 capacity", location: "1600 E 6th St, Austin, TX", regularsLove: "Indie rock and cumbia nights" },
  { concept: "Cocktail bar, 200 capacity", location: "Weserstraße 50, Berlin", regularsLove: "Techno and house" },
  { concept: "Craft brewery taproom, 300 seats", location: "55 Mill St, Toronto, ON", regularsLove: "Alt country and folk rock" },
  { concept: "Jazz cafe, 80 seats", location: "Rua do Norte 20, Lisbon", regularsLove: "Jazz and bossa nova" },
  { concept: "Dive bar with a stage, 120 capacity", location: "2011 W North Ave, Chicago, IL", regularsLove: "Punk and garage rock" },
];

const base = process.argv[2] ?? "http://127.0.0.1:3000";
/** `--only berlin` runs just the rooms whose address contains the word. */
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]?.toLowerCase()
  : undefined;

async function runRoom(room: (typeof ROOMS)[number]) {
  const t0 = Date.now();
  let firstStep: number | null = null;
  let pitchAt: number | null = null;
  const steps: string[] = [];
  let pitch: Record<string, unknown> | undefined;
  let summary: Record<string, unknown> | undefined;
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(room),
  });
  if (!res.ok || !res.body) {
    return { room, status: res.status, error: (await res.text()).slice(0, 200), ms: Date.now() - t0 };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
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
        if (c.type === "data-step" && c.data) {
          firstStep ??= Date.now() - t0;
          const s = c.data as { kind?: string; status?: string; label?: string };
          steps.push(`${s.kind}:${s.status}`);
        }
        if (c.type === "data-pitch" && c.data) {
          pitch = c.data;
          pitchAt = Date.now() - t0;
        }
        if (c.type === "data-summary" && c.data) summary = c.data;
      }
    }
  }
  const p = pitch as
    | { headliner?: { name?: string }; opener?: { name?: string } | null; neighborhoods?: unknown[]; alternates?: unknown[]; qlooCalls?: unknown[]; meta?: { cityLabel?: string; headlinerPoolSize?: number } }
    | undefined;
  return {
    room: room.location,
    ms: Date.now() - t0,
    firstStepMs: firstStep,
    pitchMs: pitchAt,
    headliner: p?.headliner?.name ?? null,
    opener: p?.opener?.name ?? null,
    city: p?.meta?.cityLabel ?? null,
    pool: p?.meta?.headlinerPoolSize ?? null,
    hoods: p?.neighborhoods?.length ?? 0,
    alternates: p?.alternates?.length ?? 0,
    qlooCalls: p?.qlooCalls?.length ?? 0,
    quick: (summary as { quickMode?: boolean } | undefined)?.quickMode ?? false,
    retries: (summary as { retries?: number } | undefined)?.retries ?? null,
    weakOrFail: steps.filter((s) => /:(weak|fail)$/.test(s)),
    terminal: Boolean(pitch || summary),
  };
}

async function main() {
  for (const room of ROOMS) {
    if (only && !room.location.toLowerCase().includes(only)) continue;
    console.log(`\n→ ${room.location}`);
    try {
      const r = await runRoom(room);
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ room: room.location, error: String(e) }));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
