import { describe, expect, it } from "vitest";
import {
  getCachedQlooResponse,
  setCachedQlooResponse,
} from "@/lib/qloo/response-cache";

describe("qloo response cache", () => {
  it("stores and reads by normalized url key", async () => {
    await setCachedQlooResponse(
      "https://example.com/a?X-Api-Key=secret",
      { ok: true },
      60_000,
    );
    await expect(
      getCachedQlooResponse<{ ok: boolean }>(
        "https://example.com/a?X-Api-Key=other",
      ),
    ).resolves.toEqual({ ok: true });
  });

  it("expires entries past ttl", async () => {
    await setCachedQlooResponse("https://example.com/b", { n: 1 }, 1);
    await new Promise((r) => setTimeout(r, 5));
    await expect(getCachedQlooResponse("https://example.com/b")).resolves.toBeUndefined();
  });
});
