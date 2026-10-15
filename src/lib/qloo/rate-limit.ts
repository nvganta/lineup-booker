/** Qloo hackathon limit: 5 requests / second. */
const MIN_INTERVAL_MS = 220;

let lastRequestAt = 0;
let chain: Promise<void> = Promise.resolve();

export function scheduleQlooRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastRequestAt = Date.now();
    return fn();
  };

  const result = chain.then(run, run);
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
