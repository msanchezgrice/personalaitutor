"use client";

import { useEffect, useMemo } from "react";
import { readClientAttributionEnvelope } from "@/lib/attribution";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { SIGN_UP_INTENT_KEY } from "@/components/auth-tracking-keys";

function detectPreferredProvider() {
  const source = readClientAttributionEnvelope()?.last?.utmSource?.toLowerCase() ?? "";
  if (source.includes("linkedin")) return "linkedin";
  if (source === "x" || source.includes("twitter")) return "x";
  if (source.includes("facebook") || source.includes("meta") || source.includes("instagram")) return "facebook";
  return "google";
}

export function AuthPageTracking({
  mode,
  showHint = false,
}: {
  mode: "sign-up" | "sign-in";
  showHint?: boolean;
}) {
  const preferredProvider = useMemo(() => detectPreferredProvider(), []);

  useEffect(() => {
    if (mode === "sign-up") {
      try {
        const existing = window.sessionStorage.getItem(SIGN_UP_INTENT_KEY);
        if (!existing) {
          window.sessionStorage.setItem(
            SIGN_UP_INTENT_KEY,
            JSON.stringify({ startedAt: Date.now(), source: "clerk_sign_up_page" }),
          );
        }
      } catch {
        // Ignore strict privacy mode storage failures.
      }
      captureAnalyticsEvent("auth_sign_up_page_viewed", {
        auth_provider: "clerk",
        funnel: "onboarding_assessment",
        source: "clerk_sign_up_page",
        preferred_provider: preferredProvider,
      });
      captureAnalyticsEvent("clerk_sign_up_viewed", {
        auth_provider: "clerk",
        funnel: "onboarding_assessment",
        source: "clerk_sign_up_page",
        preferred_provider: preferredProvider,
      });
      captureAnalyticsEvent("auth_clerk_sign_up_viewed", {
        auth_provider: "clerk",
        funnel: "onboarding_assessment",
        source: "clerk_sign_up_page",
        preferred_provider: preferredProvider,
      });
      return;
    }

    captureAnalyticsEvent("auth_sign_in_page_viewed", {
      auth_provider: "clerk",
      preferred_provider: preferredProvider,
    });
    captureAnalyticsEvent("auth_clerk_sign_in_viewed", {
      auth_provider: "clerk",
      preferred_provider: preferredProvider,
    });
  }, [mode, preferredProvider]);

  if (mode !== "sign-up" || !showHint) return null;

  return (
    <p className="mb-4 text-center text-sm text-slate-600">
      Fastest path: use the <span className="font-semibold">{preferredProvider}</span> social login button.
    </p>
  );
}
