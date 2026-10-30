import { NextResponse } from "next/server";
import { getPersistentStore } from "@/lib/cache/persistent-store";
import {
  musicBrainzActLinks,
  type ActLink,
} from "@/lib/agent/research/musicbrainz";
import { findActContacts, type ActReach } from "@/lib/book/find-contact";
import { wikidataActLinks } from "@/lib/book/wikidata-links";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** One link per network, earlier sources first. */
function mergeLinks(...sources: ActLink[][]): ActLink[] {
  const byLabel = new Map<string, ActLink>();
  for (const links of sources) {
    for (const l of links) if (!byLabel.has(l.label)) byLabel.set(l.label, l);
  }
  return [...byLabel.values()];
}

/**
 * How an owner can reach an act: its official links from MusicBrainz, or
 * Wikidata when MusicBrainz has none, plus the profiles and any booking
 * address printed on its own website.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const name = params.get("name")?.trim() ?? "";
  const mbid = params.get("mbid")?.trim() || undefined;
  if (!name || name.length > 120 || (mbid && !/^[0-9a-f-]{36}$/i.test(mbid))) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const store = getPersistentStore();
  const key = `act-reach:v6:${mbid ?? name.toLowerCase()}`;
  const cached = await store.get<ActReach>(key);
  if (cached)
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });

  let reach: ActReach = { links: [], emails: [] };
  let complete = true;
  try {
    const mb = await musicBrainzActLinks(
      name,
      mbid,
      AbortSignal.timeout(8000),
    ).catch(() => null);
    if (mb === null) complete = false;
    const listed = mb?.length
      ? mb
      : await wikidataActLinks(name, AbortSignal.timeout(5000)).catch(() => []);
    const website = listed.find((l) => l.label === "Website")?.url;
    const {
      parked,
      socials = [],
      ...found
    } = website
      ? await findActContacts(website, AbortSignal.timeout(8000)).catch(
          () => ({ emails: [] }) as Awaited<ReturnType<typeof findActContacts>>,
        )
      : { emails: [] };
    const links = mergeLinks(listed, socials);
    reach = {
      links: parked ? links.filter((l) => l.url !== website) : links,
      ...found,
    };
  } catch {
    complete = false;
  }
  // A lookup that failed partway isn't the act's real answer; don't keep it.
  if (complete || reach.links.length > 0) await store.set(key, reach, TTL_MS);
  return NextResponse.json(reach, {
    headers: {
      "Cache-Control": complete
        ? "public, max-age=3600, s-maxage=86400"
        : "no-store",
    },
  });
}
