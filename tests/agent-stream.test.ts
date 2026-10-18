import { describe, expect, it } from "vitest";
import { consumeAgentStream } from "@/lib/agent/consume-agent-stream";
import type { PitchPayload } from "@/lib/agent/types";

const minimalPitch: PitchPayload = {
  venueLabel: "Fixture venue",
  address: "1 Main St",
  moodLine: "Fixture mood",
  headlinerWhy: "Fixture Alpha fits.",
  openerWhy: "Fixture Beta opens.",
  headliner: { id: "h1", name: "Fixture Alpha" },
  opener: null,
  alternates: [],
  neighborhoods: [],
  evidenceFootnotes: {},
};

describe("consumeAgentStream", () => {
  it("parses custom data-* SSE chunks", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "data-step",
              id: "s1",
              data: {
                id: "s1",
                kind: "venue",
                status: "done",
                label: "Locating the room",
              },
            })}\n\n`,
          ),
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "data-pitch",
              id: "pitch",
              data: minimalPitch,
            })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const res = new Response(body);
    const { state: final, terminal } = await consumeAgentStream(res, () => {});
    expect(terminal).toBe(true);
    expect(final.steps).toHaveLength(1);
    expect(final.pitch?.headliner.name).toBe("Fixture Alpha");
  });
});
