import { getQlooConfig, QlooApiError, QlooConfigError } from "./config";
import { getAgentRuntime } from "@/lib/agent/runtime";
import { mockQlooJsonForUrl } from "./mock-transport";
import { scheduleQlooRequest } from "./rate-limit";
import { recordQlooCall } from "./receipts";
import {
  getCachedQlooResponse,
  setCachedQlooResponse,
} from "./response-cache";

export type QlooQueryParams = Record<
  string,
  string | number | boolean | undefined
>;

function buildSearchParams(params: QlooQueryParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  return search;
}

export type QlooRequestMeta = {
  method: "GET";
  path: string;
  query: string;
};

export async function qlooGet<T>(
  path: string,
  params: QlooQueryParams,
): Promise<{ data: T; request: QlooRequestMeta; cached?: boolean }> {
  const { apiKey, baseUrl } = getQlooConfig();
  if (!apiKey) {
    throw new QlooConfigError(
      "QLOO_API_KEY is not configured. Add it to your environment to generate lineups.",
    );
  }

  const query = buildSearchParams(params).toString();
  const url = `${baseUrl}${path}${query ? `?${query}` : ""}`;

  const cached = await getCachedQlooResponse<T>(url);
  if (cached) {
    recordQlooCall(path, params, cached, true);
    return {
      data: cached,
      request: { method: "GET", path, query },
      cached: true,
    };
  }

  getAgentRuntime()?.budget.useQloo();

  const mocked = mockQlooJsonForUrl(url);
  if (mocked != null) {
    const data = mocked as T;
    await setCachedQlooResponse(url, data);
    return {
      data,
      request: { method: "GET", path, query },
    };
  }

  const correlationId = crypto.randomUUID();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await scheduleQlooRequest(() =>
      fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
        "X-Correlation-Id": correlationId,
      },
        cache: "no-store",
      }),
    );

    if (response.ok) {
      const data = (await response.json()) as T;
      await setCachedQlooResponse(url, data);
      recordQlooCall(path, params, data, false);
      return {
        data,
        request: { method: "GET", path, query },
      };
    }

    const retryable = [429, 500, 502, 503, 504].includes(response.status);
    const body = await response.text().catch(() => "");
    lastError = new QlooApiError(
      body.slice(0, 200) || `Qloo request failed (${response.status})`,
      response.status,
      retryable,
    );

    if (!retryable || attempt === 2) break;

    const retryAfter = response.headers.get("Retry-After");
    const delayMs = retryAfter
      ? Math.min(Number(retryAfter) * 1000, 30_000)
      : 250 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw lastError ?? new QlooApiError("Qloo request failed", 500);
}
