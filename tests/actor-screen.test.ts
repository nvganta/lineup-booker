import { describe, expect, it } from "vitest";
import { isActorFirstLead } from "@/lib/agent/research/actor-screen";

describe("isActorFirstLead", () => {
  it("flags actor-first Wikipedia leads", () => {
    expect(
      isActorFirstLead("Fixture Celeb is an American actress."),
    ).toBe(true);
    expect(
      isActorFirstLead(
        "Fixture Celeb is an American actress, singer, and author.",
      ),
    ).toBe(true);
    expect(
      isActorFirstLead("Fixture Celeb is an American singer and actress."),
    ).toBe(false);
    expect(
      isActorFirstLead("Fixture Celeb is a Canadian indie folk singer."),
    ).toBe(false);
  });
});
