import { NextResponse } from "next/server";
import { getPersistentStore } from "@/lib/cache/persistent-store";
import { musicBrainzActLinks } from "@/lib/agent/research/musicbrainz";
import { findActContacts, type ActContacts, type ActReach } from "@/lib/book/find-contact";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;


/**
 * How an owner can reach an act: its website and socials from MusicBrainz,
 * plus any booking address printed on its own site.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const name = params.get("name")?.trim() ?? "";
  const mbid = params.get("mbid")?.trim() || undefined;
  if (!name || name.length > 120 || (mbid && !/^[0-9a-f-]{36}$/i.test(mbid))) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const store = getPersistentStore();
  const key = `act-reach:v5:${mbid ?? name.toLowerCase()}`;
  let reach = await store.get<ActReach>(key);
  if (!reach) {
    try {
      const links = await musicBrainzActLinks(name, mbid, AbortSignal.timeout(8000));
      const website = links.find((l) => l.label === "Website")?.url;
      const contacts = website
        ? await findActContacts(website, AbortSignal.timeout(8000)).catch(() => ({ emails: [] }))
        : { emails: [] };
      const { parked, ...found } = contacts as ActContacts;
      reach = { links: parked ? links.filter((l) => l.url !== website) : links, ...found };
      await store.set(key, reach, TTL_MS);
    } catch {
      reach = { links: [], emails: [] };
    }
  }
  return NextResponse.json(reach, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
