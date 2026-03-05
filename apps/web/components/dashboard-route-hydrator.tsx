"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    __AITUTOR_ROUTE_HYDRATE?: () => Promise<void> | void;
    __AITUTOR_LAST_HYDRATED_PATH?: string;
  }
}

export function DashboardRouteHydrator() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const targetPath = (pathname || "/dashboard").replace(/\/+$/, "") || "/";

    const run = async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (cancelled) return;
        if (typeof window !== "undefined" && typeof window.__AITUTOR_ROUTE_HYDRATE === "function") {
          const lastHydratedPath = (window.__AITUTOR_LAST_HYDRATED_PATH || "").replace(/\/+$/, "") || "/";
          if (lastHydratedPath === targetPath && document.documentElement.getAttribute("data-runtime-ready") === "1") {
            return;
          }
          await window.__AITUTOR_ROUTE_HYDRATE();
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
