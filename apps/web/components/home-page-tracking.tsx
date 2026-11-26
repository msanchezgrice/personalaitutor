"use client";

import { useEffect } from "react";
import { captureAnalyticsEvent } from "@/lib/analytics";

/**
 * Calls to action the landing page tracks as `landing_cta_clicked`: every link
 * into the career map (`/map`, `/map?upload=1`), the trial and sign-up links,
 * and anything carrying a `cta-*` test id (the hero submit button, the film's
 * play button, the Remapped link).
 */
export const LANDING_CTA_SELECTOR = [
  "a[href^='/map']",
  "a[href*='/sign-up']",
  "a[href^='/dashboard/proof']",
  "[data-testid^='cta-']",
].join(", ");

function ctaName(node: HTMLElement) {
  const testId = node.getAttribute("data-testid");
  if (testId) return testId;
  return (node.textContent || "cta").trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60);
}

function ctaDestination(node: HTMLElement) {
  if (node instanceof HTMLAnchorElement) return node.href;
  const declared = node.getAttribute("data-cta-destination");
  return declared ? new URL(declared, window.location.origin).toString() : null;
}

export function HomePageTracking() {
  useEffect(() => {
    captureAnalyticsEvent("landing_page_viewed", {
      funnel: "acquisition_activation",
      location: "home",
      landing_variant: "career_map_home",
    });

    // One delegated listener: it also covers CTAs that render after hydration.
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const node = target.closest<HTMLElement>(LANDING_CTA_SELECTOR);
      if (!node) return;
      captureAnalyticsEvent("landing_cta_clicked", {
        funnel: "acquisition_activation",
        location: node.getAttribute("data-cta-location") ?? (node.closest("header") ? "nav" : "page"),
        cta: ctaName(node),
        destination: ctaDestination(node),
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
