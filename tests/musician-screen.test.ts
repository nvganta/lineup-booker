import { describe, expect, it, vi, afterEach } from "vitest";
import { isVerifiedMusicianForBench } from "@/lib/agent/research/musician-screen";
import {
  resetResearchFetch,
  setResearchFetch,
} from "@/lib/agent/research/fetch";

describe("bench musician screen", () => {
  afterEach(() => {
    resetResearchFetch();
  });

  it("drops ambiguous name collisions (musician vs comics writer)", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const title = decodeURIComponent(url.split("/summary/")[1] ?? "");
      if (title.includes("Fixture_Collision")) {
        return new Response(
          JSON.stringify({
            title: "Fixture Collision",
            description: "British comics writer.",
            extract: "Fixture Collision is a comics writer and novelist.",
          }),
          { status: 200 },
        );
      }
      if (title.includes("(musician)")) {
        return new Response(
          JSON.stringify({
            title: "Fixture Collision (musician)",
            description: "Australian musician.",
            extract: "Fixture Collision is an Australian musician and violinist.",
          }),
          { status: 200 },
        );
      }
      return new Response("", { status: 404 });
    });
    setResearchFetch(fetch);

    const ok = await isVerifiedMusicianForBench("Fixture Collision");
    expect(ok).toBe(false);
  });

  it("keeps a row when Qloo pins the musician Wikipedia title", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const title = decodeURIComponent(url.split("/summary/")[1] ?? "");
      if (title === "Fixture_Violin") {
        return new Response(
          JSON.stringify({
            title: "Fixture Violin",
            description: "Musician.",
            extract: "Fixture Violin is an Australian musician and violinist.",
          }),
          { status: 200 },
        );
      }
      return new Response("", { status: 404 });
    });
    setResearchFetch(fetch);

    const ok = await isVerifiedMusicianForBench("Fixture Violin", {
      wikipediaTitle: "Fixture Violin",
    });
    expect(ok).toBe(true);
  });
});
