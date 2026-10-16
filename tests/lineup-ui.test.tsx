/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LineupCard } from "@/components/lineup-card";
import { DEMO_LINEUP } from "@/lib/demo-lineup";
import { artistMonogram } from "@/lib/artist-monogram";

describe("artistMonogram", () => {
  it("builds initials from artist names", () => {
    expect(artistMonogram("Fixture Artist Alpha")).toBe("FA");
    expect(artistMonogram("Zed")).toBe("ZE");
  });
});

describe("LineupCard", () => {
  it("renders headliner and opener names", () => {
    render(<LineupCard lineup={DEMO_LINEUP} preview />);
    expect(screen.getByText("Sample headliner")).toBeTruthy();
    expect(screen.getByText("Sample opener")).toBeTruthy();
    expect(screen.getByText("Promote nearby")).toBeTruthy();
  });
});
