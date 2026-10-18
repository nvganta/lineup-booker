import { describe, expect, it } from "vitest";
import {
  buildOpenerOriginByActId,
  openerOriginMatchesForAct,
} from "@/lib/lineup/opener-origin-meta";
import type { AgentSessionState, PitchPayload } from "@/lib/agent/types";

describe("opener origin meta", () => {
  it("marks local from audit originMatch even when session flag was stale", () => {
    const session = {
      openerEntity: { id: "op-roc", name: "Fixture Roc" },
      openerOriginMatchesCity: false,
      openerAudit: [
        {
          id: "op-roc",
          name: "Fixture Roc",
          kept: true,
          originMatch: true,
          hasLocalSignal: true,
          reason: "selected",
        },
      ],
    } as AgentSessionState;
    const map = buildOpenerOriginByActId(session);
    expect(map["op-roc"]).toBe(true);
  });

  it("resolves badge for current opener id from per-act map", () => {
    const pitch = {
      opener: { id: "op-roc", name: "Fixture Roc" },
      meta: {
        openerOriginMatchesCity: false,
        openerOriginByActId: { "op-roc": true },
      },
    } as unknown as PitchPayload;
    expect(openerOriginMatchesForAct(pitch, "op-roc")).toBe(true);
  });
});
