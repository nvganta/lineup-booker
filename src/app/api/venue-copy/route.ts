import { NextResponse } from "next/server";
import { z } from "zod";
import { venueDisplayName } from "@/lib/lineup/venue-display";
import { draftVenueCopy } from "@/lib/venue/drafted-copy";

export const maxDuration = 60;

const bodySchema = z.object({
  headliner: z.string().min(1).max(120),
  opener: z.string().max(120).nullable().optional(),
  cityLabel: z.string().min(1).max(120),
  concept: z.string().max(400).default(""),
  street: z.string().max(200).default(""),
  neighborhoods: z.array(z.string().max(120)).max(8).default([]),
  localActs: z.array(z.string().max(120)).max(2).default([]),
  styleTags: z.array(z.string().max(60)).max(6).default([]),
  rows: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        kind: z.enum(["drink", "food", "late", "diet"]),
        fans: z.number().int().min(0).max(50),
        city: z.number().int().min(0).max(50),
      }),
    )
    .max(8)
    .default([]),
  fanSample: z.number().int().min(0).max(50),
  citySample: z.number().int().min(0).max(50),
  nearEatDrink: z.array(z.string().max(120)).max(6).default([]),
});

/** Drafted deal ideas and captions, written by the agent from the real counts. */
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
  const b = parsed.data;
  const ups = b.rows.filter((r) => r.fans > r.city && r.kind !== "diet").length;
  const nearby = b.nearEatDrink.length >= 2 ? 1 : 0;
  // Fans who don't out-index the city on anything still go somewhere near
  // the room; that tie-in is the one special the data supports.
  const ideaCount =
    b.rows.length >= 2 && ups > 0 ? Math.min(ups, 2) + nearby : nearby;
  const copy = await draftVenueCopy(
    {
      headliner: b.headliner,
      opener: b.opener ?? null,
      cityLabel: b.cityLabel,
      venueName: venueDisplayName(b.concept),
      street: b.street,
      neighborhoods: b.neighborhoods.slice(0, 3),
      rows: b.rows,
      fanSample: b.fanSample,
      citySample: b.citySample,
      nearEatDrink: b.nearEatDrink,
      localActs: b.localActs,
      styleTags: b.styleTags,
    },
    ideaCount,
  );
  return NextResponse.json({ copy });
}
