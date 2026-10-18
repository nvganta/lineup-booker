import { readableTagLabels, trimTagLabelForDisplay } from "@/lib/agent/step-copy";
import { popularityPercentileLine } from "@/lib/copy/ordinal";

export type ActWhyContext = {
  cityLabel: string;
  tagLabels: string[];
  headlinerPoolSize?: number;
  headlinerRankInPool?: number;
  headlinerPopularity?: number;
  openerPopularity?: number;
};

function primaryTagLabel(labels: string[]): string | null {
  const human = readableTagLabels(
    labels.map((l) => trimTagLabelForDisplay(l)),
  );
  const first = human[0];
  return first ? trimTagLabelForDisplay(first) : null;
}

/** One meaningful fact from Qloo discovery data; null if nothing honest to say. */
export function headlinerWhyFromQloo(ctx: ActWhyContext): string | null {
  const tag = primaryTagLabel(ctx.tagLabels);
  if (
    ctx.headlinerRankInPool != null &&
    ctx.headlinerPoolSize != null &&
    ctx.headlinerPoolSize > 0
  ) {
    const tagPhrase = tag ? `${tag} fans` : "this room's taste";
    return `#${ctx.headlinerRankInPool} of ${ctx.headlinerPoolSize} acts in the pool for ${tagPhrase} near ${ctx.cityLabel}.`;
  }
  if (ctx.headlinerPopularity != null && Number.isFinite(ctx.headlinerPopularity)) {
    return popularityPercentileLine(ctx.headlinerPopularity);
  }
  return null;
}

export function openerWhyFromQloo(ctx: ActWhyContext): string | null {
  if (ctx.openerPopularity != null && Number.isFinite(ctx.openerPopularity)) {
    return popularityPercentileLine(ctx.openerPopularity);
  }
  return null;
}
