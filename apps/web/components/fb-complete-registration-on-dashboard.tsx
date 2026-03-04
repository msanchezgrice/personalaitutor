"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { fbCompleteRegistration } from "@/lib/fb-pixel";

const PENDING_SESSION_KEY = "ai_tutor_pending_onboarding_session_v1";
const COMPLETE_REGISTRATION_FIRED_KEY = "ai_tutor_complete_registration_fired_v1";

export function FbCompleteRegistrationOnDashboard() {
  const searchParams = useSearchParams();
  const firedInSessionRef = useRef(false);

  useEffect(() => {
    if (firedInSessionRef.current) return;
    if (typeof window === "undefined") return;

    try {
      if (window.sessionStorage.getItem(COMPLETE_REGISTRATION_FIRED_KEY) === "1") {
        return;
      }
    } catch {
      // Storage access can fail in strict privacy modes.
    }

    const welcome = searchParams.get("welcome");
    const onboardingSessionId = searchParams.get("onboardingSessionId");
    let hasPendingSession = false;

    try {
      const raw = window.sessionStorage.getItem(PENDING_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { sessionId?: string };
        hasPendingSession = Boolean(parsed?.sessionId);
      }
    } catch {
      hasPendingSession = false;
    }

    if (!(welcome === "1" && (onboardingSessionId || hasPendingSession))) return;

    firedInSessionRef.current = true;
    fbCompleteRegistration("clerk");

    try {
      window.sessionStorage.setItem(COMPLETE_REGISTRATION_FIRED_KEY, "1");
      window.sessionStorage.removeItem(PENDING_SESSION_KEY);
    } catch {
      // Ignore storage failures; event already sent.
    }
  }, [searchParams]);

  return null;
}
