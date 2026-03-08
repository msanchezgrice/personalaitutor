"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { trackAdCompleteRegistration } from "@/lib/ad-conversions";
import { captureAnalyticsEvent, identifyAnalyticsUser } from "@/lib/analytics";
import {
  COMPLETE_REGISTRATION_FIRED_KEY,
  SIGN_UP_COMPLETION_TRACKED_KEY,
  SIGN_UP_INTENT_KEY,
} from "@/components/auth-tracking-keys";

function onboardingSessionIdFromLocation() {
  try {
    return new URL(window.location.href).searchParams.get("onboardingSessionId");
  } catch {
    return null;
  }
}

function readStoredSignUpIntent() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(SIGN_UP_INTENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { source?: unknown; startedAt?: unknown } | null;
    const source =
      typeof parsed?.source === "string" && parsed.source.trim() ? parsed.source.trim() : undefined;
    const startedAtValue = parsed?.startedAt;
    const signupStartedAt =
      typeof startedAtValue === "number" && Number.isFinite(startedAtValue)
        ? new Date(startedAtValue).toISOString()
        : typeof startedAtValue === "string" && startedAtValue.trim()
          ? startedAtValue.trim()
          : undefined;

    return {
      source,
      signupStartedAt,
    };
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
    const signUpIntent = readStoredSignUpIntent();
    let completionAlreadyTracked = false;
    try {
      completionAlreadyTracked = window.sessionStorage.getItem(SIGN_UP_COMPLETION_TRACKED_KEY) === "1";
    } catch {
      completionAlreadyTracked = false;
    }

    authEventTrackedRef.current = true;
    if (signUpIntent?.signupStartedAt) {
      if (!completionAlreadyTracked) {
        captureAnalyticsEvent("clerk_sign_up_completed", {
          auth_provider: "clerk",
          source: signUpIntent.source ?? "auth_completion_tracker",
          signup_started_at: signUpIntent.signupStartedAt,
        });
        captureAnalyticsEvent("auth_clerk_sign_up_completed", {
          auth_provider: "clerk",
          source: signUpIntent.source ?? "auth_completion_tracker",
          signup_started_at: signUpIntent.signupStartedAt,
        });
        try {
          window.sessionStorage.setItem(SIGN_UP_COMPLETION_TRACKED_KEY, "1");
        } catch {
          // Ignore strict privacy mode storage errors.
        }
      }
      captureAnalyticsEvent("auth_sign_up_completed", {
        auth_provider: "clerk",
        source: signUpIntent.source ?? "auth_completion_tracker",
        signup_started_at: signUpIntent.signupStartedAt,
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

      const signUpIntent = readStoredSignUpIntent();
      if (!signUpIntent) return;
      source = signUpIntent.source;
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
