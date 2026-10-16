import { describe, expect, it } from "vitest";
import {
  isClearlyMusician,
  isConflictingNonMusicianProfile,
} from "@/lib/agent/research/match";

describe("conflicting non-musician profiles", () => {
  it("flags comics writers with the same display name", () => {
    const name = "Fixture Collision";
    const text = "Fixture Collision is a British comics writer and novelist.";
    expect(isClearlyMusician(text, name, name)).toBe(false);
    expect(isConflictingNonMusicianProfile(text, name, name)).toBe(true);
  });
});
