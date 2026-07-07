"use client";

import { useEffect } from "react";

/**
 * The anonymous assessment + report pages are always-dark standalone surfaces.
 * The root layout defaults `data-theme="light"`, and styles.css light-theme
 * rules repaint .text-white/.text-gray-* to near-black with !important —
 * dark-on-dark on these pages. Pin the root theme to dark while mounted.
 */
export function ForceDarkTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "dark");
    return () => {
      root.setAttribute("data-theme", previous ?? "light");
    };
  }, []);

  return null;
}
