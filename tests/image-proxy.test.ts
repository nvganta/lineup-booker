import { describe, expect, it, afterEach } from "vitest";
import {
  isImageProxyAllowedHost,
  proxiedImageUrl,
  resetImageProxyTestHosts,
  setImageProxyTestHosts,
} from "@/lib/image-proxy";

describe("image proxy allowlist", () => {
  it("proxies Qloo image hosts", () => {
    const url = "https://images.qloo.com/path/photo.jpg";
    const proxied = proxiedImageUrl(url)!;
    expect(proxied.startsWith("/api/image-proxy/")).toBe(true);
    expect(proxied).not.toContain("?url=");
  });

  it("rejects unknown hosts from proxy helper passthrough", () => {
    const url = "https://other.example/photo.jpg";
    expect(proxiedImageUrl(url)).toBe(url);
  });

  it("allowlist check", () => {
    expect(isImageProxyAllowedHost("images.qloo.com")).toBe(true);
    expect(isImageProxyAllowedHost("evil.example")).toBe(false);
  });

  it("allows test-only hosts via injection", () => {
    setImageProxyTestHosts(["example.test"]);
    expect(isImageProxyAllowedHost("example.test")).toBe(true);
    expect(
      proxiedImageUrl("https://example.test/photo.jpg"),
    ).toContain("/api/image-proxy");
    resetImageProxyTestHosts();
  });

  afterEach(() => {
    resetImageProxyTestHosts();
  });
});
