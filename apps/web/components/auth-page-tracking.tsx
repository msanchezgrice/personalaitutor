"use client";

import { useEffect, useMemo } from "react";
import { readClientAttributionEnvelope } from "@/lib/attribution";

const SIGN_UP_INTENT_KEY = "ai_tutor_clerk_signup_intent_v1";

function capture(event: string, props?: Record<string, unknown>) {
  try {
    const ph = (window as unknown as { posthog?: { capture: (name: string, properties?: Record<string, unknown>) => void } }).posthog;
    if (!ph?.capture) return;
    const last = readClientAttributionEnvelope()?.last;
    ph.capture(event, {
      funnel: "onboarding_assessment",
      utm_source: last?.utmSource ?? null,
      utm_medium: last?.utmMedium ?? null,
      utm_campaign: last?.utmCampaign ?? null,
      paid_source:
        last?.utmSource?.toLowerCase().includes("linkedin")
          ? "linkedin"
          : last?.utmSource === "x" || last?.utmSource?.toLowerCase().includes("twitter")
            ? "x"
            : last?.utmSource?.toLowerCase().includes("facebook") || last?.utmSource?.toLowerCase().includes("meta")
              ? "facebook"
              : "unknown",
      ...(props ?? {}),
    });
  } catch {
    // Ignore analytics runtime errors.
  }
}

function detectPreferredProvider() {
  const source = readClientAttributionEnvelope()?.last?.utmSource?.toLowerCase() ?? "";
  if (source.includes("linkedin")) return "linkedin";
  if (source === "x" || source.includes("twitter")) return "x";
  if (source.includes("facebook") || source.includes("meta") || source.includes("instagram")) return "facebook";
  return "google";
}

export function AuthPageTracking({ mode }: { mode: "sign-up" | "sign-in" }) {
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
      capture("clerk_sign_up_started", { auth_provider: "clerk", source: "clerk_sign_up_page", preferred_provider: preferredProvider });
      capture("clerk_sign_up_viewed", { auth_provider: "clerk", preferred_provider: preferredProvider });
      capture("auth_clerk_sign_up_viewed", { auth_provider: "clerk", preferred_provider: preferredProvider });
      return;
    }

    capture("auth_clerk_sign_in_viewed", { auth_provider: "clerk", preferred_provider: preferredProvider });
  }, [mode, preferredProvider]);

  if (mode !== "sign-up") return null;

  return (
    <p className="mb-4 text-center text-sm text-slate-600">
      Fastest path: use the <span className="font-semibold">{preferredProvider}</span> social login button.
    </p>
  );
}
