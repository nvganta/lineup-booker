import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { geocodeWithRetries } from "@/lib/geocode/nominatim";

describe("geocodeWithRetries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resolves 1 Rivington St, London EC2A after stripping outward postcode", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      const q = u.searchParams.get("q") ?? "";
      const street = u.searchParams.get("street");
      if (
        q.includes("1 Rivington St, London") ||
        street === "1 Rivington St"
      ) {
        return new Response(
          JSON.stringify([
            {
              lat: "51.5263",
              lon: "-0.0833",
              display_name: "1 Rivington Street, London",
              address: {
                city: "London",
                state: "England",
                country: "United Kingdom",
              },
            },
          ]),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocodeWithRetries("1 Rivington St, London EC2A");
    await vi.runAllTimersAsync();
    const hit = await promise;

    expect(hit?.cityForHeatmap).toBe("London");
    expect(hit?.lat).toBeCloseTo(51.5263, 3);
  });
});
