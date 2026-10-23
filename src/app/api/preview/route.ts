import { NextResponse } from "next/server";
import { fetchArtistPreviews } from "@/lib/preview/itunes";

/** Three 30-second previews for an act, from Apple's public search. No key, cached. */
export async function GET(req: Request) {
  const artist = new URL(req.url).searchParams.get("artist")?.trim() ?? "";
  if (!artist || artist.length > 120) {
    return NextResponse.json({ error: "artist required" }, { status: 400 });
  }
  try {
    const tracks = await fetchArtistPreviews(artist);
    return NextResponse.json(
      { tracks },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
    );
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
