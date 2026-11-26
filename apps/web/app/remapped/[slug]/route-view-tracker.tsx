"use client";

import { useEffect } from "react";
import { captureAnalyticsEvent } from "@/lib/analytics";

/** Fires `remapped_route_viewed` once per route page view. Renders nothing. */
export function RemappedRouteViewTracker({ slug, fromTitle, toTitleId }: { slug: string; fromTitle: string; toTitleId: string }) {
  useEffect(() => {
    captureAnalyticsEvent("remapped_route_viewed", {
      route_slug: slug,
      from_title: fromTitle,
      to_title_id: toTitleId,
      page_path: `/remapped/${slug}`,
    });
  }, [slug, fromTitle, toTitleId]);
  return null;
}
