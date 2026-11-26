"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copies a URL to the clipboard. `value` may be a path ("/map/abc"); it is
 * resolved against the current origin before copying so the learner always
 * gets a link that works when pasted elsewhere.
 */
export function RouteCopyLink({ value, label = "Copy link", testId }: { value: string; label?: string; testId?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function handleCopy() {
    let text = value;
    try {
      text = new URL(value, window.location.origin).toString();
    } catch {
      text = value;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (!ok) throw new Error("COPY_FAILED");
      }
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  }

  return (
    <span className="rm-row" style={{ gap: 10 }}>
      <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={handleCopy} data-testid={testId}>
        {state === "copied" ? "Copied" : label}
      </button>
      <span role="status" aria-live="polite" className={state === "failed" ? "rm-small" : "rm-sr-only"}>
        {state === "copied" ? "Link copied" : state === "failed" ? "Could not copy. Select the link and copy it." : ""}
      </span>
    </span>
  );
}
