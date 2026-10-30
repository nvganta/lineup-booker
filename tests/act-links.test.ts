import { describe, expect, it } from "vitest";
import { actLinksFromRelations } from "@/lib/agent/research/musicbrainz";

const rel = (type: string, url: string, ended = false) => ({ type, ended, url: { resource: url } });

describe("act links", () => {
  it("puts booking and the website first, labels socials by site, and drops the rest", () => {
    const links = actLinksFromRelations([
      rel("social network", "https://www.instagram.com/someact/"),
      rel("streaming", "https://open.spotify.com/artist/x"),
      rel("official homepage", "https://someact.com"),
      rel("social network", "https://twitter.com/someact", true),
      rel("booking", "https://agency.example/someact"),
      rel("bandcamp", "https://someact.bandcamp.com"),
      rel("social network", "https://www.facebook.com/someact"),
    ]);
    expect(links.map((l) => l.label)).toEqual(["Booking", "Website", "Instagram", "Facebook"]);
  });

  it("returns nothing when MusicBrainz lists nothing useful", () => {
    expect(actLinksFromRelations([rel("streaming", "https://open.spotify.com/artist/x")])).toEqual([]);
  });
});
