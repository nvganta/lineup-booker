import { describe, expect, it, vi, afterEach } from "vitest";
import { consumeAgentStream } from "@/lib/agent/consume-agent-stream";
import {
  agentStreamHasTerminalEvent,
  recoverIncompleteAgentStream,
  salvagePitchFromStreamState,
} from "@/lib/agent/stream-recover";
import type { LineupRequest } from "@/lib/lineup/schemas";

const request: LineupRequest = {
  concept: "Fixture Room 200 cap",
  location: "1 Fixture St, Fixtureton",
  regularsLove: "indie folk",
};

describe("agent stream recovery", () => {
  it("detects a stream that ended without pitch or summary", () => {
    expect(agentStreamHasTerminalEvent({ steps: [], artists: [] })).toBe(false);
    expect(
      agentStreamHasTerminalEvent({
        steps: [],
        artists: [],
        pitch: {
          venueLabel: "Fixture",
          address: "1 Main",
          moodLine: "Fixture mood",
          headlinerWhy: "Fixture",
          openerWhy: "Fixture",
          headliner: { id: "h1", name: "Fixture Alpha" },
          opener: null,
          alternates: [],
          neighborhoods: [],
          evidenceFootnotes: {},
        },
      }),
    ).toBe(true);
  });

  it("salvages from partial stream state when map pins exist", () => {
    const pitch = salvagePitchFromStreamState(
      {
        steps: [],
        artists: [
          { id: "h1", name: "Fixture Alpha", role: "headliner" },
          { id: "o1", name: "Fixture Beta", role: "opener" },
        ],
        map: {
          venue: { lat: 1, lon: 2 },
          pins: [
            { rank: 1, name: "Fixture Heights", lat: 1.01, lon: 2.01 },
            { rank: 2, name: "Fixture Flats", lat: 1.02, lon: 2.02 },
          ],
        },
      },
      request,
    );
    expect(pitch?.headliner.name).toBe("Fixture Alpha");
    expect(pitch?.neighborhoods).toHaveLength(2);
  });

  it("recovers when the SSE body ends mid-run without a pitch", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "data-artist",
              id: "a1",
              data: {
                id: "h1",
                name: "Fixture Alpha",
                role: "headliner",
              },
            })}\n\n`,
          ),
        );
        controller.close();
      },
    });

    const { state, terminal } = await consumeAgentStream(
      new Response(body),
      () => {},
    );
    expect(terminal).toBe(false);

    const fetchMock = vi.fn(async () =>
      Response.json({
        lineup: {
          venueLabel: "Fixture Room",
          headliner: { id: "h1", name: "Fixture Alpha" },
          opener: null,
          alternates: [],
          neighborhoods: [{ rank: 1, name: "Fixture Heights", lat: 1, lon: 2 }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const recovered = await recoverIncompleteAgentStream(state, request, () => {});
    expect(recovered.pitch?.headliner.name).toBe("Fixture Alpha");
    expect(recovered.summary?.quickMode).toBe(true);

    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
