import { describe, expect, test } from "vitest";
import nextConfig from "../../apps/web/next.config";

/**
 * Prod funnel audit (2026-07): the CSP blocked https://www.googletagmanager.com
 * so the Google tag (gtag.js) never loaded and no Google Ads / GA4 conversion
 * ever fired. Adapted from the parked park/wip-funnel-tests attempt, trimmed
 * to the minimum sources GA4 + Google Ads conversion tracking actually need
 * (the parked wildcard/server-side-GTM domains are not in use).
 */

async function readCspDirectives() {
  const headerRules = await nextConfig.headers?.();
  const csp = headerRules
    ?.flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy")
    ?.value ?? "";

  const directives = new Map<string, string>();
  for (const directive of csp.split(";")) {
    const trimmed = directive.trim();
    if (!trimmed) continue;
    directives.set(trimmed.split(" ")[0], trimmed);
  }
  return directives;
}

describe("content security policy allows the Google tag", () => {
  test("script-src allows the gtag.js loader", async () => {
    const directives = await readCspDirectives();
    expect(directives.get("script-src")).toContain("https://www.googletagmanager.com");
  });

  test("connect-src allows GA4 + Google Ads measurement endpoints", async () => {
    const directives = await readCspDirectives();
    const connectSrc = directives.get("connect-src") ?? "";
    expect(connectSrc).toContain("https://www.google-analytics.com");
    expect(connectSrc).toContain("https://analytics.google.com");
    expect(connectSrc).toContain("https://stats.g.doubleclick.net");
    expect(connectSrc).toContain("https://www.googletagmanager.com");
  });

  test("img-src already permits any https image beacon", async () => {
    // Google measurement pixel fallbacks (google-analytics.com,
    // googleads.g.doubleclick.net, www.google.com) are covered by the blanket
    // https: source — no explicit additions required.
    const directives = await readCspDirectives();
    expect(directives.get("img-src")).toContain("https:");
  });

  test("frame-src allows the Google Ads conversion iframe", async () => {
    const directives = await readCspDirectives();
    expect(directives.get("frame-src")).toContain("https://td.doubleclick.net");
  });

  test("pre-existing sources stay untouched", async () => {
    const directives = await readCspDirectives();
    expect(directives.get("script-src")).toContain("https://connect.facebook.net");
    expect(directives.get("connect-src")).toContain("https://*.posthog.com");
    expect(directives.get("frame-src")).toContain("https://challenges.cloudflare.com");
    expect(directives.get("default-src")).toBe("default-src 'self'");
  });
});
