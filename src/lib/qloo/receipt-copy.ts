// Client-safe: turns a recorded Qloo request into a line an owner or judge can read.
import type { QlooReceipt } from "@/lib/qloo/receipts";

export type ReceiptLine = {
  title: string;
  /** The parameters that shaped the answer, in request order, ids swapped for names. */
  params: Array<[string, string]>;
  /** The exact request, for anyone who wants to replay it. */
  request: string;
};

/** "urn:tag:genre:music:indie_folk" → "indie folk" */
export function tagWords(urn: string): string {
  const last = urn.split(":").pop() ?? urn;
  return last.replace(/_/g, " ");
}

function list(raw: string | undefined, names: Map<string, string>): string {
  return (raw ?? "")
    .split(",")
    .filter(Boolean)
    .map((v) => names.get(v) ?? (v.startsWith("urn:tag:") ? tagWords(v) : v))
    .join(", ");
}

function insightsTitle(p: Record<string, string>, names: Map<string, string>): string {
  const type = p["filter.type"] ?? "";
  const seed = list(p["signal.interests.entities"], names);
  const tags = list(p["signal.interests.tags"], names);
  const results = list(p["filter.results.entities"], names);
  const city = p["signal.location.query"] ?? p["filter.location.query"];

  if (type === "urn:heatmap") {
    const by = p["output.heatmap.boundary"] ? "by neighbourhood" : "on a fine grid";
    return `Mapped where ${seed ? `${seed}'s fans` : `${tags} fans`} live in ${city ?? "the city"}, ${by}`;
  }
  if (type === "urn:demographics") return `Profiled who ${seed || tags} fans are`;
  if (type === "urn:entity:place") {
    if (p["filter.location"]) return `Found spots near the venue that ${seed}'s fans love`;
    if (seed) return `Found where ${seed}'s fans eat and drink in ${city}`;
    return `Found ${city}'s usual spots, as a baseline`;
  }
  if (type === "urn:tag") return `Found genres next to ${seed || tags}`;
  if (type === "urn:entity:artist") {
    if (results && seed) return `Scored ${results} against ${seed}'s fans`;
    if (results) return `Checked how ${results} index in ${city ?? "this city"}`;
    if (seed) return `Found acts ${seed}'s fans also love${tags ? `, within ${tags}` : ""}`;
    const band =
      p["filter.popularity.min"] || p["filter.popularity.max"]
        ? `, sized for the room (popularity ${p["filter.popularity.min"] ?? "0"}–${p["filter.popularity.max"] ?? "1"})`
        : "";
    return `Found ${tags || "matching"} acts near the venue${band}`;
  }
  return `Asked Qloo for ${type.replace("urn:entity:", "") || "insights"}`;
}

export function describeReceipt(r: QlooReceipt, names: Map<string, string>): ReceiptLine {
  const p = r.params;
  let title: string;
  if (r.path === "/v2/tags") title = `Turned "${p["filter.query"]}" into Qloo taste tags`;
  else if (r.path === "/search") title = `Looked up "${p.query}" in Qloo`;
  else if (r.path === "/v2/analysis/compare")
    title = `Compared the tastes of ${list(p["a.signal.interests.entities"], names)} and ${list(p["b.signal.interests.entities"], names)} fans`;
  else title = insightsTitle(p, names);

  const params = Object.entries(p).map(([k, v]): [string, string] => [
    k,
    k.endsWith(".entities") || k.endsWith(".tags") ? list(v, names) : v,
  ]);
  const query = new URLSearchParams(p).toString();
  return { title, params, request: `GET ${r.path}?${query}` };
}
