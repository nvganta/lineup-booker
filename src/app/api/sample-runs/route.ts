import { parseSampleRuns } from "@/lib/sample-runs";

/** Saved example runs from server env. No Qloo calls; the data never ships in the repo. */
export function GET() {
  return Response.json(parseSampleRuns(process.env.SAMPLE_RUNS_JSON), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
