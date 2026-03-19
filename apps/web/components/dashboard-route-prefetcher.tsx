"use client";

import { useEffect } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";

const DASHBOARD_PREFETCH_ORDER: Record<string, Route[]> = {
  "/dashboard": [
    "/dashboard/projects",
    "/dashboard/chat",
    "/dashboard/updates",
    "/dashboard/social",
    "/dashboard/ai-news",
    "/dashboard/profile",
  ],
  "/dashboard/chat": [
    "/dashboard/projects",
    "/dashboard",
    "/dashboard/updates",
    "/dashboard/social",
    "/dashboard/ai-news",
    "/dashboard/profile",
  ],
  "/dashboard/projects": [
    "/dashboard/chat",
    "/dashboard",
    "/dashboard/updates",
    "/dashboard/social",
    "/dashboard/ai-news",
    "/dashboard/profile",
  ],
  "/dashboard/social": [
    "/dashboard/projects",
    "/dashboard",
    "/dashboard/chat",
    "/dashboard/ai-news",
    "/dashboard/updates",
    "/dashboard/profile",
  ],
  "/dashboard/ai-news": [
    "/dashboard",
    "/dashboard/updates",
    "/dashboard/projects",
    "/dashboard/chat",
    "/dashboard/social",
    "/dashboard/profile",
  ],
  "/dashboard/updates": [
    "/dashboard",
    "/dashboard/projects",
    "/dashboard/chat",
    "/dashboard/ai-news",
    "/dashboard/social",
    "/dashboard/profile",
  ],
  "/dashboard/profile": [
    "/dashboard",
    "/dashboard/projects",
    "/dashboard/chat",
    "/dashboard/updates",
    "/dashboard/social",
    "/dashboard/ai-news",
  ],
};

function normalizedPath(pathname: string | null) {
  return (pathname || "/dashboard").replace(/\/+$/, "") || "/";
}

export function DashboardRoutePrefetcher() {
  const pathname = normalizedPath(usePathname());
  const router = useRouter();

  useEffect(() => {
    const queue = (DASHBOARD_PREFETCH_ORDER[pathname] ?? DASHBOARD_PREFETCH_ORDER["/dashboard"]).filter((href) => href !== pathname);
    const timeouts: number[] = [];
    const idleHandles: number[] = [];

    queue.forEach((href, index) => {
      const timeoutId = window.setTimeout(() => {
        if ("requestIdleCallback" in window) {
          const idleId = window.requestIdleCallback(() => {
            router.prefetch(href);
          }, { timeout: 1500 + index * 300 });
          idleHandles.push(idleId);
          return;
        }

        router.prefetch(href);
      }, 250 + index * 450);

      timeouts.push(timeoutId);
    });

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if ("cancelIdleCallback" in window) {
        idleHandles.forEach((idleId) => window.cancelIdleCallback(idleId));
      }
    };
  }, [pathname, router]);

  return null;
}
