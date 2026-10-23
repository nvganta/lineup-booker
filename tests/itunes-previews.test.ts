import { describe, expect, it } from "vitest";
import { pickPreviews } from "@/lib/preview/itunes";

const song = (trackId: number, trackName: string, artistName: string, previewUrl = "https://x/p.m4a") => ({
  trackId,
  trackName,
  artistName,
  previewUrl,
  kind: "song",
});

describe("pickPreviews", () => {
  it("keeps only the act's own songs, three at most, one per title", () => {
    const out = pickPreviews("Fixture & Co", [
      song(1, "River", "Fixture and Co"),
      song(2, "River (Radio Mix)", "Fixture & Co"),
      song(3, "Harbour", "Fixture & Co"),
      song(4, "Other", "Someone Else"),
      song(5, "Lantern", "Fixture & Co"),
      song(6, "Fourth", "Fixture & Co"),
    ]);
    expect(out.map((t) => t.title)).toEqual(["River", "Harbour", "Lantern"]);
  });

  it("drops rows with no preview", () => {
    expect(pickPreviews("A", [{ ...song(1, "X", "A"), previewUrl: undefined }])).toEqual([]);
  });
});
