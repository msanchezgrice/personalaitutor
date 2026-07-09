import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ATTRIBUTION_STORAGE_KEY } from "@/lib/attribution";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { buildGoogleAdsSendTo, buildGoogleTagInitScript, trackGoogleAdsConversion } from "@/lib/google-ads";

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

  test("omits currency when a Google Ads conversion does not include a billed value", () => {
    const gtag = vi.fn();

    globalThis.window = {
      gtag,
    } as unknown as typeof window;

    try {
      const tracked = trackGoogleAdsConversion("trial_start_label", {
        currency: "USD",
        transactionId: "cs_test_trial_123",
      });

      expect(tracked).toBe(true);
      expect(gtag).toHaveBeenCalledWith(
        "event",
        "conversion",
        expect.objectContaining({
          send_to: "AW-18023517759/trial_start_label",
          transaction_id: "cs_test_trial_123",
        }),
      );
      expect(gtag).not.toHaveBeenCalledWith(
        "event",
        "conversion",
        expect.objectContaining({
          currency: "USD",
        }),
      );
    } finally {
      // @ts-expect-error test cleanup
      delete globalThis.window;
    }
  });
});

describe("analytics GA forwarding", () => {
  type MockStorage = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };

  function createLocalStorage(seed: Record<string, string> = {}): MockStorage {
    const store = new Map(Object.entries(seed));
    return {
      getItem(key) {
        return store.get(key) ?? null;
      },
      setItem(key, value) {
        store.set(key, value);
      },
      removeItem(key) {
        store.delete(key);
      },
    };
  }

  function stubBrowser(input: { gtag?: (...args: unknown[]) => void; capture?: (...args: unknown[]) => void }) {
    const storage = createLocalStorage({
      [ATTRIBUTION_STORAGE_KEY]: JSON.stringify({
        first: {
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "brand_search",
          landingPath: "/",
        },
        last: {
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "brand_search",
          gclid: "gclid_123",
          landingPath: "/quiz",
        },
      }),
    });

    globalThis.window = {
      location: {
        pathname: "/quiz",
        href: "https://www.myaiskilltutor.com/quiz?utm_source=google",
      },
      localStorage: storage,
      posthog: input.capture
        ? {
            capture: input.capture,
            get_distinct_id: () => "ph_distinct_1",
          }
        : undefined,
      ...(input.gtag ? { gtag: input.gtag } : {}),
    } as unknown as typeof window;

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {} as Navigator,
    });
  }

  const originalWindow = globalThis.window;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalGaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalGaId;
    if (originalWindow === undefined) {
      // @ts-expect-error test cleanup
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
    } else {
      // @ts-expect-error test cleanup
      delete globalThis.navigator;
    }
  });

  test("forwards funnel events to GA4 with attribution fields when GA is configured", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-537WWFYHRQ";
    const capture = vi.fn();
    const gtag = vi.fn();
    stubBrowser({ gtag, capture });

    captureAnalyticsEvent("quiz_completed", {
      event_id: "quiz_evt_1",
      score: 84,
    });

    expect(capture).toHaveBeenCalledWith(
      "quiz_completed",
      expect.objectContaining({
        utm_source: "google",
        gclid: "gclid_123",
      }),
    );
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "quiz_completed",
      expect.objectContaining({
        utm_source: "google",
        gclid: "gclid_123",
        score: 84,
      }),
    );
  });

  test("does not forward to GA4 when no measurement id is configured", () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    const capture = vi.fn();
    const gtag = vi.fn();
    stubBrowser({ gtag, capture });

    captureAnalyticsEvent("quiz_completed", { event_id: "quiz_evt_2" });

    expect(capture).toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
  });

  test("a throwing gtag never blocks the primary PostHog capture", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-537WWFYHRQ";
    const capture = vi.fn();
    const gtag = vi.fn(() => {
      throw new Error("gtag exploded");
    });
    stubBrowser({ gtag, capture });

    const captured = captureAnalyticsEvent("quiz_completed", { event_id: "quiz_evt_3" });

    expect(captured).toBe(true);
    expect(capture).toHaveBeenCalled();
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
