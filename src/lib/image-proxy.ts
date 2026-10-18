import { encodeImageProxyTarget } from "@/lib/image-proxy-encode";

const PROD_ALLOWED = new Set(["images.qloo.com"]);

let testExtraHosts = new Set<string>();

/** Test-only: allow extra proxy hosts (e.g. example.test). */
export function setImageProxyTestHosts(hosts: string[]): void {
  testExtraHosts = new Set(hosts);
}

export function resetImageProxyTestHosts(): void {
  testExtraHosts = new Set();
}

function allowedHosts(): Set<string> {
  const hosts = new Set(PROD_ALLOWED);
  for (const h of testExtraHosts) hosts.add(h);
  return hosts;
}

/** Same-origin URL for canvas-safe images (poster export). */
export function proxiedImageUrl(
  url: string | undefined,
): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return undefined;
    }
    if (!allowedHosts().has(parsed.hostname)) {
      return url;
    }
    return `/api/image-proxy/${encodeImageProxyTarget(url)}`;
  } catch {
    return undefined;
  }
}

export function isImageProxyAllowedHost(hostname: string): boolean {
  return allowedHosts().has(hostname);
}
