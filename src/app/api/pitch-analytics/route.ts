import {
  buildPitchAnalytics,
  type PitchAnalyticsInput,
} from "@/lib/lineup/pitch-analytics";
import { withQlooReceipts } from "@/lib/qloo/receipts";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  cityQuery: z.string().min(1),
  countryQuery: z.string().min(1),
  cityLabel: z.string().min(1),
  concept: z.string(),
  regularsLove: z.string(),
  musicTagIds: z.array(z.string()).default([]),
  headliner: z.object({ id: z.string(), name: z.string() }),
  opener: z
    .object({ id: z.string(), name: z.string() })
    .nullable()
    .optional(),
  bench: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .default([]),
  openerOriginMatchesCity: z.boolean().optional(),
  headlinerPoolSize: z.number().optional(),
  headlinerRankInPool: z.number().optional(),
  headlinerPopularity: z.number().optional(),
  openerPopularity: z.number().optional(),
  tagLabels: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const input = parsed.data as PitchAnalyticsInput;
  try {
    const { result, receipts } = await withQlooReceipts(() =>
      buildPitchAnalytics(input),
    );
    return NextResponse.json({
      analytics: { ...result.analytics, qlooCalls: receipts },
    });
  } catch (err) {
    console.error("[pitch-analytics]", err);
    return NextResponse.json(
      { error: "Analytics unavailable" },
      { status: 503 },
    );
  }
}
