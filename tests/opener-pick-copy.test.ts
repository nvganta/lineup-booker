import { describe, expect, it } from "vitest";
import {
  buildOpenerPickLinesByActId,
  openerPickLineFromEvidence,
} from "@/lib/lineup/opener-pick-copy";
import type { AgentSessionState } from "@/lib/agent/types";

describe("opener pick copy", () => {
  it("does not claim local without origin match", () => {
    const line = openerPickLineFromEvidence({
      name: "Fixture Twin",
      headlinerName: "Fixture Headliner",
      originMatch: false,
      popularity: 0.62,
    });
    expect(line).not.toMatch(/local act/i);
    expect(line).toContain("listener reach");
  });

  it("keeps stable lines per act id for swap back", () => {
    const session = {
      headlinerEntity: { id: "h", name: "Fixture Headliner" },
      openerEntity: { id: "twin", name: "Fixture Twin" },
      openerAudit: [
        {
          id: "twin",
          name: "Fixture Twin",
          kept: true,
          originMatch: false,
          popularity: 0.62,
          hasLocalSignal: false,
          reason: "selected",
        },
        {
          id: "david",
          name: "Fixture David",
          kept: false,
          originMatch: true,
          popularity: 0.69,
          hasLocalSignal: true,
          reason: "runner-up for opener slot",
        },
      ],
      openerSwapQueue: [
        {
          id: "david",
          name: "Fixture David",
          reason: "origin matches venue",
          popularity: 0.69,
        },
      ],
    } as AgentSessionState;
    const lines = buildOpenerPickLinesByActId(session);
    expect(lines.twin).not.toMatch(/local act/i);
    expect(lines.david).toMatch(/local act/i);
  });
});
