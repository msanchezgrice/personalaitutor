"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Copies a value to the clipboard and says so. The value itself is always
 * rendered as visible text next to the button, so it can be selected by hand
 * when the clipboard API is unavailable.
 */
export function SiteCopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "rm-btn rm-btn--secondary rm-btn--sm",
  testId,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  testId?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  }

  return (
    <button type="button" className={className} onClick={copy} data-testid={testId}>
      <span aria-live="polite">{state === "copied" ? copiedLabel : state === "failed" ? "Select and copy it" : label}</span>
    </button>
  );
}
