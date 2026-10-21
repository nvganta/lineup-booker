import { AsyncLocalStorage } from "node:async_hooks";

/**
 * One Qloo request as the owner (and a judge) can inspect it: the endpoint,
 * the parameters we chose, how many results came back, and whether it cost a
 * call or came from cache. Never includes the API key, which is a header.
 */
export type QlooReceipt = {
  path: string;
  params: Record<string, string>;
  results: number;
  cached: boolean;
};

const current = new AsyncLocalStorage<QlooReceipt[]>();

/** Collect every Qloo request made while `fn` runs, however deep. */
export async function withQlooReceipts<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; receipts: QlooReceipt[] }> {
  const receipts: QlooReceipt[] = [];
  const result = await current.run(receipts, fn);
  return { result, receipts };
}

/** The receipts collected so far in this run, or [] outside one. */
export function currentQlooReceipts(): QlooReceipt[] {
  return [...(current.getStore() ?? [])];
}

export function recordQlooCall(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  data: unknown,
  cached: boolean,
): void {
  const store = current.getStore();
  if (!store) return;
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") clean[k] = String(v);
  }
  store.push({ path, params: clean, results: countResults(data), cached });
}

function countResults(data: unknown): number {
  const d = data as {
    results?: { entities?: unknown[]; tags?: unknown[]; heatmap?: unknown[] } | unknown[];
    tags?: unknown[];
  };
  if (Array.isArray(d?.results)) return d.results.length;
  const r = d?.results;
  return r?.entities?.length ?? r?.tags?.length ?? r?.heatmap?.length ?? d?.tags?.length ?? 0;
}
