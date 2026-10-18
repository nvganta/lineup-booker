import { describe, expect, it } from "vitest";
import { readableTagLabels } from "@/lib/agent/step-copy";

describe("readableTagLabels", () => {
  it("does not leave leading spaces in humanized tags", () => {
    const labels = readableTagLabels([
      "Indie - Rock",
      " indie rock",
      "  indie rock  ",
    ]);
    expect(labels[0]).toBe("indie rock");
    expect(labels.every((l) => l === l.trim())).toBe(true);
  });
});
