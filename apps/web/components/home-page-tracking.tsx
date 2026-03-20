"use client";

import { useEffect } from "react";
import { captureAnalyticsEvent } from "@/lib/analytics";

export function HomePageTracking() {
  useEffect(() => {
    captureAnalyticsEvent("landing_page_viewed", {
      funnel: "acquisition_activation",
      location: "home",
      landing_variant: "default_home",
    });

    const ctaNodes = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        "a[href*='/sign-up?redirect_url=/onboarding/'], a[href*='/sign-up/?redirect_url=/onboarding/']",
      ),
    );

    if (!ctaNodes.length) return;

    const listeners = ctaNodes.map((node, index) => {
      const listener = () => {
        captureAnalyticsEvent("landing_cta_clicked", {
          funnel: "acquisition_activation",
          location: index === 0 ? "hero" : "page",
          cta: (node.textContent || "start_assessment").trim().toLowerCase().replace(/\s+/g, "_"),
          destination: node.href,
        });
      };
      node.addEventListener("click", listener);
      return { node, listener };
    });

    return () => {
      for (const entry of listeners) {
        entry.node.removeEventListener("click", entry.listener);
      }
    };
  }, []);

  return null;
}
