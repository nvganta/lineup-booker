import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

describe("nominatim persistent cache", () => {
  const tmpFile = path.join(os.tmpdir(), `nominatim-test-${Date.now()}.json`);

  beforeEach(() => {
    process.env.NOMINATIM_CACHE_PATH = tmpFile;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.NOMINATIM_CACHE_PATH;
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  });

  it("survives write failures without throwing", async () => {
    const { writePersistentCache, readPersistentCache } = await import(
      "@/lib/geocode/nominatim-cache"
    );
    writePersistentCache("key", { city: "London" });
    expect(readPersistentCache<{ city: string }>("key")?.city).toBe("London");

    const readOnlyDir = path.join(os.tmpdir(), "nominatim-ro-test");
    fs.mkdirSync(readOnlyDir, { recursive: true });
    process.env.NOMINATIM_CACHE_PATH = path.join(readOnlyDir, "nested", "cache.json");
    vi.resetModules();
    const mod = await import("@/lib/geocode/nominatim-cache");
    expect(() =>
      mod.writePersistentCache("k2", { ok: true }),
    ).not.toThrow();
  });
});
