import { describe, expect, it, beforeEach } from "vitest";
import {
  clearQlooResponseCache,
  getCachedQlooResponse,
  setCachedQlooResponse,
} from "@/lib/qloo/response-cache";

describe("Qloo response cache", () => {
  beforeEach(() => {
    clearQlooResponseCache();
  });

  it("returns cached payload within TTL", () => {
    setCachedQlooResponse("https://example.com/a", { ok: true }, 60_000);
    expect(getCachedQlooResponse<{ ok: boolean }>("https://example.com/a")).toEqual({
      ok: true,
    });
  });

  it("expires stale entries", () => {
    setCachedQlooResponse("https://example.com/b", { n: 1 }, -1);
    expect(getCachedQlooResponse("https://example.com/b")).toBeUndefined();
  });
});
