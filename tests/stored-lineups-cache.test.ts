import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadStoredLineups,
  resetStoredLineupsCacheForTests,
} from "@/lib/stored-lineups";

describe("loadStoredLineups snapshot cache", () => {
  afterEach(() => {
    resetStoredLineupsCacheForTests();
    vi.unstubAllGlobals();
  });

  it("returns the same array reference until localStorage changes", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
      dispatchEvent: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    const a = loadStoredLineups();
    const b = loadStoredLineups();
    expect(a).toBe(b);

    store["lineup-booker:your-lineups"] = JSON.stringify([
      {
        id: "x",
        venueLabel: "Fixture",
        cityLabel: "Fixtureton",
        headlinerName: "Fixture Act",
        request: {
          concept: "Fixture bar",
          location: "1 Main",
          regularsLove: "indie",
        },
        pitch: {
          venueLabel: "Fixture",
          address: "1 Main",
          moodLine: "m",
          headlinerWhy: "h",
          openerWhy: "o",
          headliner: { id: "h", name: "Fixture Act" },
          opener: null,
          alternates: [],
          neighborhoods: [],
          evidenceFootnotes: {},
        },
        savedAt: 1,
      },
    ]);

    const c = loadStoredLineups();
    expect(c).not.toBe(a);
    const d = loadStoredLineups();
    expect(c).toBe(d);
  });
});
