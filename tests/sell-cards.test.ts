import { describe, expect, it } from "vitest";
import { liftLabel, sellCards } from "@/lib/venue/sell-cards";

describe("liftLabel", () => {
  it("reads as a multiple when the gap is wide, a count when it is not", () => {
    expect(liftLabel(10, 5)).toBe("2×");
    expect(liftLabel(6, 4)).toBe("1.5×");
    expect(liftLabel(6, 5)).toBe("+1");
    expect(liftLabel(4, 0)).toBe("fans only");
  });
});

describe("sellCards", () => {
  it("keeps the three widest over-indexes and words each count", () => {
    const { top, rest } = sellCards({
      rows: [
        { label: "Late night", kind: "late", fans: 10, city: 5 },
        { label: "Burgers", kind: "food", fans: 6, city: 1 },
        { label: "Pub", kind: "drink", fans: 4, city: 1 },
        { label: "Craft beer", kind: "drink", fans: 5, city: 3 },
        { label: "Gluten free", kind: "diet", fans: 1, city: 14 },
      ],
      ideas: [{ title: "Keep the kitchen open late", body: "Plates after the set.", basis: "Late night" }],
      headliner: "Fixture Act",
      cityLabel: "Testville",
      fanSample: 15,
      citySample: 15,
    });
    expect(top.map((t) => t.label)).toEqual(["Late night", "Burgers", "Pub"]);
    expect(top[0]).toMatchObject({
      lift: "2×",
      line: "10 of Fixture Act fans' top 15 spots are open late. 5 of Testville's top 15 do.",
    });
    expect(top[0]?.idea?.title).toBe("Keep the kitchen open late");
    expect(top[1]?.line).toContain("serve burgers");
    expect(top[1]?.idea).toBeNull();
    expect(top[1]?.fallback).toBe("Put burgers on special that night.");
    expect(top[2]?.line).toContain("are a pub");
    expect(rest.map((r) => r.label)).toEqual(["Craft beer", "Gluten free"]);
  });
});
