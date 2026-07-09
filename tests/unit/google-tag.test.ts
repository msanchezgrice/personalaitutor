import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { buildGoogleAdsSendTo, buildGoogleTagInitScript } from "@/lib/google-ads";

/**
 * Google tag bootstrap (adapted from the parked park/wip-funnel-tests
 * attempt). The layout's inline gtag bootstrap only configured the Ads tag
 * (AW-…); GA4 never received a config call even once the CSP allowed
 * googletagmanager.com. buildGoogleTagInitScript now configures every
 * provided destination from the single gtag.js loader.
 */

const layoutPath = path.resolve(process.cwd(), "apps/web/app/layout.tsx");

describe("google tag wiring", () => {
  const originalEnv = {
    googleAdsId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    googleAdsTagId: process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID,
  };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-18023517759";
    process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID = "";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = originalEnv.googleAdsId;
    process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID = originalEnv.googleAdsTagId;
  });

  test("keeps Google Ads conversions pointed at the AW destination", () => {
    expect(buildGoogleAdsSendTo("signup_label")).toBe("AW-18023517759/signup_label");
  });

  test("builds a bootstrap tag script that configures both Ads and GA", () => {
    const script = buildGoogleTagInitScript({
      bootstrapId: "GT-WPL8SM78",
      adsId: "AW-18023517759",
      gaMeasurementId: "G-537WWFYHRQ",
    });

    expect(script).toContain("window.dataLayer = window.dataLayer || []");
    expect(script).toContain("gtag('js', new Date())");
    expect(script).toContain("gtag('config', \"GT-WPL8SM78\")");
    expect(script).toContain("gtag('config', \"AW-18023517759\")");
    expect(script).toContain("gtag('config', \"G-537WWFYHRQ\")");
  });

  test("Ads-only configuration keeps working when no GA id is set", () => {
    const script = buildGoogleTagInitScript({
      bootstrapId: null,
      adsId: "AW-18023517759",
      gaMeasurementId: "",
    });

    expect(script).toContain("gtag('config', \"AW-18023517759\")");
    expect(script).not.toContain("gtag('config', \"\")");
  });

  test("duplicate ids are configured once and empty input renders nothing", () => {
    const script = buildGoogleTagInitScript({
      bootstrapId: "AW-18023517759",
      adsId: "AW-18023517759",
      gaMeasurementId: null,
    });
    expect(script.match(/gtag\('config'/g)).toHaveLength(1);

    expect(buildGoogleTagInitScript({ bootstrapId: null, adsId: null, gaMeasurementId: null })).toBe("");
  });
});

describe("layout loads the shared gtag bootstrap", () => {
  const layoutSource = readFileSync(layoutPath, "utf8");

  test("the gtag.js loader points at googletagmanager.com", () => {
    expect(layoutSource).toContain("https://www.googletagmanager.com/gtag/js?id=");
  });

  test("the inline init script comes from the shared builder with GA + Ads ids", () => {
    expect(layoutSource).toContain('from "@/lib/google-ads"');
    expect(layoutSource).toContain("buildGoogleTagInitScript(");
    expect(layoutSource).toContain("NEXT_PUBLIC_GA_MEASUREMENT_ID");
    expect(layoutSource).toContain("NEXT_PUBLIC_GOOGLE_TAG_ID");
    // No stale local builder remains.
    expect(layoutSource).not.toContain("function buildGoogleAdsInitScript");
  });
});
