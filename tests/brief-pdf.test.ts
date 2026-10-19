import { describe, expect, it } from "vitest";
import { buildBriefPdf } from "@/lib/book/brief-pdf";

describe("brief pdf", () => {
  it("writes a valid one-page PDF with escaped text", () => {
    const bytes = buildBriefPdf({
      title: "The Paper Gulls with Fern Static",
      venueLine: "Natural wine bar · 12 Harbour Row (back room)",
      neighborhoods: ["Harbour Flats"],
      ideas: [{ title: "Wine flight", stat: "30 vs 20", body: "Pour three natural wines." }],
      posts: ["Folk night. Doors at [time]."],
      note: "Drafted by the agent.",
    });
    const s = Buffer.from(bytes).toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("/Count 1");
    expect(s).toContain("\\(back room\\)");
    const xref = Number(s.match(/startxref\n(\d+)/)![1]);
    expect(s.slice(xref, xref + 4)).toBe("xref");
  });
});
