import { isImageProxyAllowedHost } from "@/lib/image-proxy";

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

function isStandardPort(url: URL): boolean {
  if (url.protocol === "https:") return !url.port || url.port === "443";
  if (url.protocol === "http:") return !url.port || url.port === "80";
  return false;
}

export type ImageProxyFetchResult =
  | { ok: true; body: Uint8Array; contentType: string }
  | { ok: false; status: number; error: string };

export async function fetchAllowedImage(
  rawUrl: string,
): Promise<ImageProxyFetchResult> {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return { ok: false, status: 400, error: "Invalid url" };
  }
  if (target.protocol !== "https:") {
    return { ok: false, status: 400, error: "HTTPS only" };
  }
  if (!isStandardPort(target)) {
    return { ok: false, status: 403, error: "Non-standard port" };
  }
  if (!isImageProxyAllowedHost(target.hostname)) {
    return { ok: false, status: 403, error: "Host not allowed" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: { Accept: "image/*" },
      redirect: "manual",
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location) {
        return { ok: false, status: 502, error: "Redirect without location" };
      }
      const redirectUrl = new URL(location, target);
      if (redirectUrl.protocol !== "https:") {
        return { ok: false, status: 403, error: "Redirect not HTTPS" };
      }
      if (!isStandardPort(redirectUrl)) {
        return { ok: false, status: 403, error: "Redirect non-standard port" };
      }
      if (!isImageProxyAllowedHost(redirectUrl.hostname)) {
        return { ok: false, status: 403, error: "Redirect host not allowed" };
      }
      upstream = await fetch(redirectUrl.toString(), {
        signal: controller.signal,
        headers: { Accept: "image/*" },
        redirect: "manual",
      });
    }

    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status === 404 ? 404 : 502,
        error: "Upstream failed",
      };
    }
    const type = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) {
      return { ok: false, status: 415, error: "Not an image" };
    }

    const body = upstream.body;
    if (!body) {
      return { ok: false, status: 502, error: "Empty body" };
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          controller.abort();
          return { ok: false, status: 413, error: "Image too large" };
        }
        chunks.push(value);
      }
    }
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return { ok: true, body: buf, contentType: type };
  } catch {
    return { ok: false, status: 504, error: "Fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}
