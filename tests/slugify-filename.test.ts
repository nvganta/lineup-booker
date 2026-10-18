import { describe, expect, it } from "vitest";
import { slugifyFilename } from "@/lib/copy/slugify";

describe("slugifyFilename", () => {
  it("truncates at a word boundary before max length", () => {
    const slug = slugifyFilename(
      "Natural wine and small plates cafe bar downtown",
      24,
    );
    expect(slug.length).toBeLessThanOrEqual(24);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).not.toContain("bar-d");
  });
});
