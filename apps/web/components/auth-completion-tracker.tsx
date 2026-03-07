"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { trackAdCompleteRegistration } from "@/lib/ad-conversions";
import { captureAnalyticsEvent, identifyAnalyticsUser } from "@/lib/analytics";
import { COMPLETE_REGISTRATION_FIRED_KEY, SIGN_UP_INTENT_KEY } from "@/components/auth-tracking-keys";

function onboardingSessionIdFromLocation() {
  try {
    return new URL(window.location.href).searchParams.get("onboardingSessionId");
  } catch {
    return null;
  }
}

export function AuthCompletionTracker() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const firedRef = useRef(false);
  const authEventTrackedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || typeof window === "undefined") return;

    identifyAnalyticsUser({
      distinctId: userId,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      name:
        user?.fullName?.trim() ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
        null,
      handle: user?.username ?? null,
      authProvider: "clerk",
    });
  }, [
    isLoaded,
    isSignedIn,
    userId,
    user?.firstName,
    user?.fullName,
    user?.lastName,
    user?.primaryEmailAddress?.emailAddress,
    user?.username,
  ]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || authEventTrackedRef.current || typeof window === "undefined") return;

    let intentSource: string | undefined;
    let signupStartedAt: string | undefined;

    try {
      const raw = window.sessionStorage.getItem(SIGN_UP_INTENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { source?: string; startedAt?: string } | null;
        intentSource = typeof parsed?.source === "string" && parsed.source.trim() ? parsed.source.trim() : undefined;
        signupStartedAt = typeof parsed?.startedAt === "string" && parsed.startedAt.trim() ? parsed.startedAt.trim() : undefined;
      }
    } catch {
      intentSource = undefined;
      signupStartedAt = undefined;
    }

    authEventTrackedRef.current = true;
    if (signupStartedAt) {
      captureAnalyticsEvent("auth_sign_up_completed", {
        auth_provider: "clerk",
        source: intentSource ?? "auth_completion_tracker",
        signup_started_at: signupStartedAt,
      });
      return;
    }

    captureAnalyticsEvent("auth_sign_in_completed", {
      auth_provider: "clerk",
      source: "auth_completion_tracker",
    });
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || firedRef.current || typeof window === "undefined") return;

    let source: string | undefined;
    let sessionId: string | null = null;

    try {
      if (window.sessionStorage.getItem(COMPLETE_REGISTRATION_FIRED_KEY) === "1") {
        return;
      }

      const raw = window.sessionStorage.getItem(SIGN_UP_INTENT_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { source?: string } | null;
      source = typeof parsed?.source === "string" && parsed.source.trim() ? parsed.source.trim() : undefined;
      sessionId = onboardingSessionIdFromLocation();
    } catch {
      return;
    }

    firedRef.current = true;
    trackAdCompleteRegistration({
      sessionId,
      source: source ?? "global_auth_completion_tracker",
    });

    try {
      window.sessionStorage.setItem(COMPLETE_REGISTRATION_FIRED_KEY, "1");
      window.sessionStorage.removeItem(SIGN_UP_INTENT_KEY);
    } catch {
      // Ignore strict privacy mode storage errors.
    }
  }, [isLoaded, isSignedIn]);

  return null;
}
