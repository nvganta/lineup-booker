import type { QlooEntity } from "@/lib/qloo/types";
import type { ArtistResearchHints } from "./types";

function readString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function hintsFromQlooEntity(entity: QlooEntity): ArtistResearchHints {
  const props = entity.properties ?? {};
  const description =
    readString(props.description) ?? readString(props.short_description);

  const ext = props as Record<string, unknown>;
  const external = ext.external as Record<string, unknown> | undefined;
  const wikipediaTitle =
    readString(external?.wikipedia) ??
    readString(ext.wikipedia) ??
    readString(ext.wikipedia_title);

  const wikidataId =
    readString(external?.wikidata) ?? readString(ext.wikidata);

  const country =
    readString(ext.country as string) ??
    readString((ext.origin as { country?: string })?.country);

  let wikipediaUrl: string | undefined;
  const urlCandidate = readString(ext.wikipedia_url);
  if (urlCandidate?.includes("wikipedia.org")) wikipediaUrl = urlCandidate;

  const hints: ArtistResearchHints & { wikipediaUrl?: string } = {
    description,
    wikipediaTitle,
    wikidataId,
    country,
  };
  if (wikipediaUrl) hints.wikipediaUrl = wikipediaUrl;
  return hints;
}
