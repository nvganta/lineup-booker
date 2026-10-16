import { describe, expect, it, vi, beforeEach } from "vitest";
import { headlinerDiscoverySignals } from "@/lib/agent/qloo-signals";

describe("headlinerDiscoverySignals", () => {
  it("uses POINT(lon lat) for Qloo signal.location", () => {
    const pin = {
      lat: 49.263,
      lon: -123.1,
      city: "Vancouver",
      state: "BC",
      country: "Canada",
    };
    const signals = headlinerDiscoverySignals(
      pin,
      "2509 Main St",
      ["urn:tag:genre:music:indie_folk"],
      ["Indie folk"],
    );
    expect(signals.signalLocationPoint).toBe("POINT(-123.1 49.263)");
    expect(signals.signalLocationPoint).not.toMatch(/^\d+\.\d+,-?\d+/);
  });
});

describe("discoverHeadliners transport", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("passes POINT format through to qlooGet params", async () => {
    vi.doMock("@/lib/qloo/client", () => ({
      qlooGet: vi.fn(async () => ({
        data: { results: { entities: [] } },
        request: { method: "GET", path: "/v2/insights", query: "" },
      })),
    }));
    const { qlooGet } = await import("@/lib/qloo/client");
    const { discoverHeadliners } = await import("@/lib/lineup/qloo-calls");
    const pin = { lat: 49.26, lon: -123.11, city: "Vancouver" };
    const signals = headlinerDiscoverySignals(
      pin,
      "Main St",
      ["urn:tag:genre:music:indie_folk"],
      [],
    );
    await discoverHeadliners(
      signals,
      { headlinerMin: 0.5, headlinerMax: 0.85, openerMax: 0.7 },
      [],
    );
    const params = vi.mocked(qlooGet).mock.calls[0]?.[1] as Record<
      string,
      string
    >;
    expect(params["signal.location"]).toBe("POINT(-123.11 49.26)");
  });
});
