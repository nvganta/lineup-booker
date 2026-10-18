import { attachImageUrl, artistImageFromEntity } from "@/lib/agent/lookup-artist";
import type { AgentSessionState } from "@/lib/agent/types";
import type { QlooEntity } from "@/lib/qloo/types";
import type { ProvenanceRequest } from "./translate-venue";
import { pickOpener, swapQueueFromCandidates } from "./opener-select";

export async function persistOpenerPickToSession(
  session: AgentSessionState,
  pick: Awaited<ReturnType<typeof pickOpener>>,
  opener: QlooEntity | null,
  requests: ProvenanceRequest[],
): Promise<void> {
  session.openerAudit = pick.audit;
  const chosenId = opener?.entity_id ?? opener?.id;
  const queue = swapQueueFromCandidates(pick.swapCandidates, chosenId).slice(
    0,
    5,
  );
  session.openerSwapQueue = await Promise.all(
    queue.map(async (row) => {
      const entity = pick.swapCandidates.find(
        (c) => (c.entity.entity_id ?? c.entity.id ?? c.entity.name) === row.id,
      )?.entity;
      let imageUrl: string | undefined;
      if (entity) {
        const enriched = await attachImageUrl(entity, requests);
        imageUrl = artistImageFromEntity(enriched);
      }
      return {
        ...row,
        imageUrl,
        popularity: entity?.popularity,
      };
    }),
  );
  session.openerOriginMatchesCity = pick.audit.some(
    (a) => a.kept && a.originMatch === true,
  );
  if (opener) {
    session.openerEntity = {
      id: opener.entity_id ?? opener.id ?? opener.name,
      name: opener.name,
      imageUrl: artistImageFromEntity(opener),
      popularity: opener.popularity,
    };
  }
}
