"use client";

import { useEffect, useRef } from "react";
import { fbCompleteRegistration, fbViewContent } from "@/lib/fb-pixel";

/**
 * Drop this component on any page to fire a one-time Facebook Pixel event
 * when the page mounts. Used for server-rendered pages where we can't
 * call fbq() inline (e.g. the onboarding landing page after Clerk sign-up).
 *
 * Usage:
 *   <FbPageEvent event="CompleteRegistration" />
 *   <FbPageEvent event="ViewContent" contentName="landing_page" />
 */
export function FbPageEvent({
  event,
  contentName,
}: {
  event: "CompleteRegistration" | "ViewContent";
  contentName?: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (event === "CompleteRegistration") {
      fbCompleteRegistration("clerk");
    } else if (event === "ViewContent" && contentName) {
      fbViewContent(contentName);
    }
  }, [event, contentName]);

  return null;
}
