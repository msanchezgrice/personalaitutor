"use client";

import { useEffect, useRef } from "react";
import { trackAdCheckoutCompleted } from "@/lib/ad-conversions";
import { captureAnalyticsEvent } from "@/lib/analytics";

const CHECKOUT_COMPLETED_TRACKED_KEY = "ai_tutor_checkout_completed_tracked_v1";

type DashboardEntryTrackingProps = {
  billingIntent?: string | null;
  checkoutSessionId?: string | null;
  onboardingSessionId?: string | null;
  locked?: boolean;
};

export function DashboardEntryTracking({
  billingIntent = null,
  checkoutSessionId = null,
  onboardingSessionId = null,
  locked = false,
}: DashboardEntryTrackingProps) {
  const landingTrackedRef = useRef(false);

  useEffect(() => {
    if (landingTrackedRef.current) return;
    landingTrackedRef.current = true;

    captureAnalyticsEvent("dashboard_signed_in_landed", {
      funnel: "acquisition_activation",
      billing_intent: billingIntent ?? null,
      checkout_session_id: checkoutSessionId ?? null,
      onboarding_session_id: onboardingSessionId ?? null,
      locked,
    });
  }, [billingIntent, checkoutSessionId, locked, onboardingSessionId]);

  useEffect(() => {
    if (!checkoutSessionId || billingIntent !== "success" || locked || typeof window === "undefined") {
      return;
    }

    const storageKey = `${CHECKOUT_COMPLETED_TRACKED_KEY}:${checkoutSessionId}`;
    try {
      if (window.sessionStorage.getItem(storageKey) === "1") {
        return;
      }
    } catch {
      // Continue and attempt the conversion relay once.
    }

    trackAdCheckoutCompleted({
      sessionId: checkoutSessionId,
      source: "dashboard_billing_success",
    });

    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage failures; event already sent.
    }
  }, [billingIntent, checkoutSessionId, locked]);

  return null;
}
