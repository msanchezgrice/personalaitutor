"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __AITUTOR_ROUTE_HYDRATE?: () => Promise<void> | void;
  }
}

export function DashboardRouteHydrator() {
  const pathname = usePathname();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    let cancelled = false;

    const run = async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (cancelled) return;
        if (typeof window !== "undefined" && typeof window.__AITUTOR_ROUTE_HYDRATE === "function") {
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
