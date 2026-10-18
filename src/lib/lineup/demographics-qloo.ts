import { qlooGet } from "@/lib/qloo/client";
import type { QlooInsightsResponse } from "@/lib/qloo/types";
import type { ProvenanceRequest } from "./translate-venue";
import type { CrowdDemographics } from "./pitch-analytics";

export type DemographicsFetchResult = {
  demographics: CrowdDemographics | null;
};

export async function fetchHeadlinerDemographics(
  headlinerId: string,
  locationQuery: string | undefined,
  requests: ProvenanceRequest[],
): Promise<DemographicsFetchResult> {
  try {
    const params: Record<string, string | number | boolean | undefined> = {
      "filter.type": "urn:demographics",
      "signal.interests.entities": headlinerId,
      take: 5,
    };
    if (locationQuery?.trim()) {
      params["signal.location.query"] = locationQuery.trim();
    }
    const { data, request } = await qlooGet<QlooInsightsResponse>(
      "/v2/insights",
      params,
    );
    requests.push(request);

    const results = data.results as
      | (QlooInsightsResponse["results"] & {
          demographics?: Array<{
            query?: {
              age?: Record<string, number>;
              gender?: { male?: number; female?: number };
            };
          }>;
        })
      | undefined;
    const demoQuery = results?.demographics?.[0]?.query;
    if (demoQuery?.age || demoQuery?.gender) {
      return {
        demographics: {
          age: demoQuery.age ?? null,
          gender: demoQuery.gender ?? null,
        },
      };
    }

    const entities = data.results?.entities ?? [];
    const ageBand = entities.find((e) =>
      /^\d+\s*[-–_]\s*\d+/.test(e.name ?? ""),
    );
    if (ageBand?.name) {
      const key = ageBand.name.replace(/\s+/g, "_").replace(/–/g, "_to_");
      return {
        demographics: { age: { [key]: 1 }, gender: null },
      };
    }
    return { demographics: null };
  } catch {
    return { demographics: null };
  }
}
