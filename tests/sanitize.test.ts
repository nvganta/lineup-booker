import { describe, expect, it } from "vitest";
import { sanitizeForQloo } from "@/lib/sanitize-for-qloo";

describe("sanitizeForQloo", () => {
  it("removes email addresses", () => {
    expect(sanitizeForQloo("Contact booker@test.com for holds")).toBe(
      "Contact for holds",
    );
  });
});
