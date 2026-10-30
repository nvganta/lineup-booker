function errorStatusCode(error: unknown): number | undefined {
  if (error instanceof Error && "statusCode" in error) {
    return Number((error as { statusCode?: number }).statusCode);
  }
  return undefined;
}

export function isGatewayRateLimitError(error: unknown): boolean {
  if (!error) return false;
  const name = error instanceof Error ? error.name : "";
  if (/GatewayRateLimitError|RateLimitError/i.test(name)) return true;
  const status = errorStatusCode(error);
  if (status === 429) return true;
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return /\b429\b|rate limit|too many requests|requests per minute/.test(msg);
}

export function isModelUnavailableError(error: unknown): boolean {
  if (isGatewayRateLimitError(error)) return true;
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    /unavailable|not found|does not exist|model.*denied|access denied|free tier|quota|overloaded|insufficient|funds|credit|payment required|402|503|502|404/.test(
      msg,
    ) ||
    (error instanceof Error &&
      "statusCode" in error &&
      [402, 403, 404, 503].includes(Number((error as { statusCode?: number }).statusCode)))
  );
}

/** No first chunk in time, or the step was aborted waiting on the model. */
export function isModelStallError(error: unknown): boolean {
  if (!error) return false;
  const text = `${error instanceof Error ? error.name : ""} ${String(error instanceof Error ? error.message : error)}`;
  return /timeout|timed out|abort/i.test(text);
}
