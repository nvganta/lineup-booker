import type {
  AgentFinishSummary,
  ArtistDataPart,
  MapDataPart,
  PitchPayload,
  StepDataPart,
  StreamWriter,
} from "./types";

type ChunkWriter = {
  write: (part: { type: string; id?: string; data: unknown }) => void;
};

export function createStreamWriter(writer: ChunkWriter): StreamWriter {
  return {
    writeStep(part: StepDataPart) {
      writer.write({ type: "data-step", id: part.id, data: part });
    },
    writeArtist(part: ArtistDataPart) {
      writer.write({ type: "data-artist", id: part.id, data: part });
    },
    writeMap(part: MapDataPart) {
      writer.write({ type: "data-map", id: "map", data: part });
    },
    writePitch(pitch: PitchPayload) {
      writer.write({ type: "data-pitch", id: "pitch", data: pitch });
    },
    writeSummary(summary: AgentFinishSummary) {
      writer.write({ type: "data-summary", id: "summary", data: summary });
    },
  };
}
