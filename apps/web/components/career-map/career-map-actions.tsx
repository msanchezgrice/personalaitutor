"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { describeCareerMapEmailError, isLikelyEmail } from "./input-helpers";
import styles from "./career-map.module.css";

/**
 * Client islands for the map result page. The page itself is a server
 * component; these are the only parts that need the browser.
 */

export type CareerMapViewer = "owner" | "visitor";

export function CareerMapViewTracking({ mapId, titleId, fit, viewer, signedIn }: { mapId: string; titleId: string; fit: string; viewer: CareerMapViewer; signedIn: boolean }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    captureAnalyticsEvent("career_map_viewed", { career_map_id: mapId, title_id: titleId, fit, viewer, signed_in: signedIn });
  }, [mapId, titleId, fit, viewer, signedIn]);
  return null;
}

export function CareerMapCtaLink({
  href,
  label,
  mapId,
  titleId,
  placement,
  className,
  testId,
}: {
  href: string;
  label: string;
  mapId: string;
  titleId: string;
  placement: "proof_plan" | "header";
  className?: string;
  testId?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      data-testid={testId}
      data-agent-action="start-proof-studio"
      onClick={() => captureAnalyticsEvent("career_map_signup_clicked", { career_map_id: mapId, title_id: titleId, placement, href })}
    >
      {label}
    </a>
  );
}

function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === "manual") inputRef.current?.select();
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(absolute);
        setState("copied");
        return;
      }
    } catch {
      // Fall through to the legacy path.
    }
    setState(legacyCopy(absolute) ? "copied" : "manual");
  }

  return (
    <span className={styles.copyWrap}>
      <button type="button" className={className ?? "rm-btn rm-btn--secondary rm-btn--sm"} onClick={copy} data-testid="career-map-copy-link">
        {state === "copied" ? "Link copied" : "Copy link"}
      </button>
      <span className="rm-sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Link copied to your clipboard." : ""}
      </span>
      {state === "manual" ? (
        <span className={styles.copyFallback}>
          <label className="rm-small" htmlFor="career-map-share-url">
            Your browser blocked copying. Select the link and copy it.
          </label>
          <input ref={inputRef} id="career-map-share-url" className="rm-input" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => setState("idle")}>
            Close
          </button>
        </span>
      ) : null}
    </span>
  );
}

type EmailResponse = { ok?: boolean; emailed?: boolean; error?: { code?: string } };

export function CareerMapEmailForm({ token, mapId }: { token: string; mapId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ emailed: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!isLikelyEmail(email)) {
      setError(describeCareerMapEmailError({ code: "INVALID_BODY" }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/career-map/${encodeURIComponent(token)}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as EmailResponse;
      if (!res.ok || !data.ok) {
        setError(describeCareerMapEmailError({ code: data.error?.code ?? null, status: res.status }));
        return;
      }
      const emailed = Boolean(data.emailed);
      setResult({ emailed });
      captureAnalyticsEvent("career_map_email_captured", { career_map_id: mapId, emailed });
    } catch {
      setError(describeCareerMapEmailError({ code: "NETWORK_ERROR" }));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className={styles.saveCard} role="status" data-testid="career-map-email-confirmed">
        <div className={styles.saveCopy}>
          <h2 className={styles.h3}>{result.emailed ? "Check your inbox" : "Saved"}</h2>
          <p className="rm-p">
            {result.emailed
              ? "We sent the link to this map. Nothing else unless you ask."
              : "We saved your email with this map, but the email did not go out just now. Bookmark this page so you have the link."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.saveCard} onSubmit={submit} noValidate data-testid="career-map-email-form">
      <div className={styles.saveCopy}>
        <h2 className={styles.h3}>Keep this map</h2>
        <p className="rm-p">We&apos;ll email you the link. Nothing else unless you ask.</p>
      </div>
      <div className={styles.saveField}>
        <label htmlFor="save-email" className="rm-label">
          Email
        </label>
        <input
          id="save-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className="rm-input"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "save-email-error" : undefined}
          required
        />
      </div>
      <button type="submit" className={`rm-btn rm-btn--ink ${styles.saveButton}`} disabled={busy}>
        {busy ? "Sending" : "Email me my map"}
      </button>
      {error ? (
        <p id="save-email-error" className={`rm-alert rm-alert--error ${styles.saveStatus}`} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Re-renders the server page every few seconds while a map is still generating. */
export function CareerMapAutoRefresh({ intervalMs = 4000, maxMs = 150000 }: { intervalMs?: number; maxMs?: number }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started > maxMs) {
        window.clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [router, intervalMs, maxMs]);

  return (
    <p className="rm-small" role="status" aria-live="polite">
      {gaveUp
        ? "This is taking much longer than it should. Reload the page, or draw the map again."
        : "This page checks again every few seconds. You can leave it open."}
    </p>
  );
}
