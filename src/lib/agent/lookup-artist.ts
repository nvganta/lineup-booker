import { qlooGet } from "@/lib/qloo/client";
import type { QlooEntity, QlooSearchResponse } from "@/lib/qloo/types";
import type { ProvenanceRequest } from "@/lib/lineup/translate-venue";

const imageCache = new Map<string, string | undefined>();

export function artistImageFromEntity(entity: QlooEntity): string | undefined {
  const url = entity.properties?.image?.url;
  return typeof url === "string" && url.trim() ? url.trim() : undefined;
}

export async function lookupArtistByName(
  name: string,
  requests: ProvenanceRequest[],
): Promise<QlooEntity | null> {
  const { data, request } = await qlooGet<QlooSearchResponse>("/search", {
    query: name,
    "filter.type": "urn:entity:artist",
    take: 3,
  });
  requests.push(request);
  const hit = (data.results ?? []).find(
    (e) => e.name.toLowerCase() === name.toLowerCase(),
  );
  return hit ?? data.results?.[0] ?? null;
}

export async function attachImageUrl(
  entity: QlooEntity,
  requests: ProvenanceRequest[],
): Promise<QlooEntity> {
  const id = entity.entity_id ?? entity.id;
  if (!id) return entity;
  const cached = imageCache.get(id);
  if (cached !== undefined) {
    return { ...entity, properties: { ...entity.properties, image: { url: cached } } };
  }
  const existing = artistImageFromEntity(entity);
  if (existing) {
    imageCache.set(id, existing);
    return entity;
  }
  const looked = await lookupArtistByName(entity.name, requests);
  const url = looked ? artistImageFromEntity(looked) : undefined;
  imageCache.set(id, url);
  if (!url) return entity;
  return {
    ...entity,
    properties: { ...entity.properties, image: { url } },
  };
}
