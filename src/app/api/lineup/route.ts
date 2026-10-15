import { buildLineup } from "@/lib/lineup/build-lineup";
import { lineupRequestSchema } from "@/lib/lineup/schemas";
import { GeocodeError } from "@/lib/lineup/translate-venue";
import { QlooApiError, QlooConfigError } from "@/lib/qloo/config";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = lineupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const lineup = await buildLineup(parsed.data);
    return NextResponse.json({ lineup });
  } catch (err) {
    if (err instanceof GeocodeError) {
      return NextResponse.json({ error: err.message, code: "geocode" }, { status: 422 });
    }
    if (err instanceof QlooConfigError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "missing_api_key",
        },
        { status: 503 },
      );
    }
    if (err instanceof QlooApiError) {
      const status = err.status === 401 || err.status === 403 ? 502 : err.status;
      return NextResponse.json(
        {
          error: "Qloo API request failed.",
          code: err.status === 429 ? "rate_limit" : "qloo_error",
          retryable: err.retryable,
        },
        { status: status >= 400 && status < 600 ? status : 502 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Could not build lineup.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
