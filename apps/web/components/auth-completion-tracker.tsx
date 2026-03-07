"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { trackAdCompleteRegistration } from "@/lib/ad-conversions";

const SIGN_UP_INTENT_KEY = "ai_tutor_clerk_signup_intent_v1";
const COMPLETE_REGISTRATION_FIRED_KEY = "ai_tutor_complete_registration_fired_v1";

function onboardingSessionIdFromLocation() {
  try {
    return new URL(window.location.href).searchParams.get("onboardingSessionId");
  } catch {
    return null;
  }
}

export function AuthCompletionTracker() {
  const { isLoaded, isSignedIn } = useAuth();
  const firedRef = useRef(false);

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
