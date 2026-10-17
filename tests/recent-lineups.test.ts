import { describe, expect, it } from "vitest";
import {
  labelForLineupRequest,
  lineupRequestKey,
  pushRecentLineup,
} from "@/lib/recent-lineups";

describe("recent lineups", () => {
  it("dedupes and caps session recents", () => {
    const a = {
      concept: "Fixture room A",
      location: "100 Fixture St, Fixtureton, BC",
      regularsLove: "Indie folk",
    };
    const b = {
      concept: "Fixture room B",
      location: "200 Sample Ave, Sample City, BC",
      regularsLove: "Jazz",
    };
    let list = pushRecentLineup([], a, "Run A");
    list = pushRecentLineup(list, b, "Run B");
    list = pushRecentLineup(list, a, "Run A again");
    expect(list).toHaveLength(2);
    expect(list[0]?.label).toBe("Run A again");
    expect(lineupRequestKey(a)).toBe(lineupRequestKey(a));
  });

  it("builds a readable label from the request", () => {
    const label = labelForLineupRequest({
      concept: "Natural wine and small plates cafe-bar, 300 capacity",
      location: "2509 Main St, Vancouver, BC",
      regularsLove: "Indie folk",
    });
    expect(label).toContain("Vancouver");
  });
});
