"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CAREER_MAP_DRAFT_STORAGE_KEY } from "@/lib/career-map/constants";
import { LANDING_HERO } from "./landing-content";
import styles from "./landing.module.css";

export const HERO_MAP_PATH = "/map";
export const HERO_MAP_FROM_HOME_PATH = "/map?from=home";
export const HERO_UPLOAD_PATH = "/map?upload=1";

/**
 * Where the hero form sends the visitor, and what it leaves in sessionStorage
 * for /map to pick up. Exported for tests.
 *
 * Empty text goes to /map. Otherwise the draft is stored under
 * CAREER_MAP_DRAFT_STORAGE_KEY and the visitor goes to /map?from=home, which
 * starts generating straight away. If storage is unavailable (some private
 * modes), the visitor still lands on /map, without the auto-start.
 */
export function submitHeroDraft(rawText: string, storage: Pick<Storage, "setItem"> | null): string {
  const text = rawText.trim();
  if (!text) return HERO_MAP_PATH;
  if (!storage) return HERO_MAP_PATH;
  try {
    // The box takes either; a few lines of prose is a description, not a résumé, and the result page words itself accordingly.
    const lines = text.split("\n").filter((line) => line.trim().length > 0).length;
    storage.setItem(CAREER_MAP_DRAFT_STORAGE_KEY, JSON.stringify({ text, source: lines >= 5 ? "paste" : "describe" }));
    return HERO_MAP_FROM_HOME_PATH;
  } catch {
    return HERO_MAP_PATH;
  }
}

function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function HeroForm() {
  const [text, setText] = useState("");
  const [leaving, setLeaving] = useState(false);

  // Coming back with the browser's back button can restore this page from the
  // back/forward cache with the button still in its "leaving" state.
  useEffect(() => {
    const onPageShow = () => setLeaving(false);
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (leaving) return;
    setLeaving(true);
    // A full navigation on purpose: /map reads the draft on mount, and this
    // keeps the landing page free of router state it does not need.
    window.location.assign(submitHeroDraft(text, sessionStorageOrNull()));
  }

  return (
    // Without JS the form still works: GET /map, and the textarea has no name, so
    // résumé text never ends up in a URL.
    <form id="map" action={HERO_MAP_PATH} method="get" className={styles.heroForm} onSubmit={onSubmit} data-testid="hero-map-form">
      <label htmlFor="hero-background" className={styles.heroFormLabel}>
        {LANDING_HERO.formLabel}
      </label>
      <textarea
        id="hero-background"
        className={`rm-textarea ${styles.heroTextarea}`}
        rows={4}
        placeholder={LANDING_HERO.placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        aria-describedby="hero-form-note"
      />
      <div className={styles.heroActions}>
        <button
          type="submit"
          className={`rm-btn rm-btn--primary ${styles.submit}`}
          data-testid="cta-map-career-hero"
          data-agent-action="start-career-map"
          data-cta-location="hero"
          data-cta-destination={HERO_MAP_FROM_HOME_PATH}
          disabled={leaving}
        >
          {leaving ? "Opening your map…" : LANDING_HERO.submitLabel}
        </button>
        <a
          href={HERO_UPLOAD_PATH}
          className={`rm-btn rm-btn--secondary ${styles.upload}`}
          data-testid="cta-upload-resume-hero"
          data-agent-action="upload-resume"
          data-cta-location="hero"
        >
          {LANDING_HERO.uploadLabel}
        </a>
      </div>
      <p id="hero-form-note" className="rm-small">
        {LANDING_HERO.note}
      </p>
    </form>
  );
}
