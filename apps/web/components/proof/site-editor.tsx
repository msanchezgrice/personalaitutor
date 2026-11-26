"use client";

import React, { useId, useMemo, useState, type FormEvent } from "react";
import { getCareerMapTitle, type CareerMapView, type ProofSite } from "@aitutor/shared";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { SiteCopyButton } from "@/components/proof/site-copy-button";
import styles from "./site-editor.module.css";

/**
 * Proof site editor (/dashboard/proof/site). States:
 *  - no career map and no site: send them to /map (or start blank)
 *  - map, no site: "Draft it from my map"
 *  - saved, not published: edit, preview, publish
 *  - published: public URL, copy link, view page, unpublish
 */

export type SiteEditorInitial = {
  site: ProofSite | null;
  profile: { handle: string; name: string; published: boolean };
  map: CareerMapView | null;
  siteUrl: string;
};

type Translation = { before: string; now: string };

type FormState = {
  handle: string;
  newTitle: string;
  previousRole: string;
  tagline: string;
  bio: string;
  translations: Translation[];
  contactEmail: string;
  linkedinUrl: string;
};

type ApiError = { code: string; message: string; field?: string; recoveryAction?: string };

const MAX_TRANSLATIONS = 6;
const LIMITS = { newTitle: 80, previousRole: 140, tagline: 140, bio: 1200, before: 110, now: 70 } as const;

function fromSite(site: ProofSite, handle: string): FormState {
  return {
    handle,
    newTitle: site.newTitle,
    previousRole: site.previousRole ?? "",
    tagline: site.tagline,
    bio: site.bio,
    translations: site.translations.map((row) => ({ ...row })),
    contactEmail: site.contactEmail ?? "",
    linkedinUrl: site.linkedinUrl ?? "",
  };
}

/** Prefill straight from the map, no AI: title, previous role and the map's own translations. */
function fromMap(map: CareerMapView | null, handle: string): FormState {
  const data = map?.map ?? null;
  return {
    handle,
    newTitle: data ? (getCareerMapTitle(data.primary.titleId)?.title ?? "") : "",
    previousRole: data?.person.previousTitle ?? "",
    tagline: "",
    bio: "",
    translations: data ? data.translations.slice(0, MAX_TRANSLATIONS).map((row) => ({ before: row.before, now: row.now })) : [{ before: "", now: "" }],
    contactEmail: "",
    linkedinUrl: "",
  };
}

async function callApi<T>(url: string, init: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => null)) as ({ ok?: boolean; error?: ApiError } & T) | null;
    if (!response.ok || !payload || payload.ok === false) {
      return {
        ok: false,
        error: payload?.error ?? { code: `HTTP_${response.status}`, message: "Something went wrong. Try again." },
      };
    }
    return { ok: true, data: payload };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Could not reach the server. Check your connection and try again." } };
  }
}

function errorSentence(error: ApiError, action: "draft" | "save" | "publish" | "unpublish") {
  switch (error.code) {
    case "OPENAI_CONFIG_MISSING":
      return "Drafting is not available right now. Write the fields yourself, or try again later.";
    case "PROOF_SITE_DRAFT_FAILED":
      return "The draft did not come out right, so nothing was filled in. Try again, or write the fields yourself.";
    case "CAREER_MAP_MISSING":
      return "You need a career map first.";
    case "SUBSCRIPTION_REQUIRED":
      return "Your plan is not active. Start or renew your trial to keep building your site.";
    case "UNAUTHENTICATED":
      return "Your session ended. Sign in again and retry.";
    case "HANDLE_TAKEN":
    case "HANDLE_INVALID":
      return error.message;
    case "INVALID_BODY":
      return error.message || "Some fields are missing or too long.";
    default:
      if (action === "draft") return "Drafting failed. Try again in a minute.";
      if (action === "publish") return "Publishing failed. Try again in a minute.";
      if (action === "unpublish") return "Unpublishing failed. Try again in a minute.";
      return error.message || "Saving failed. Try again in a minute.";
  }
}

function validate(form: FormState): string | null {
  if (form.newTitle.trim().length < 4) return "Add your new title (at least 4 characters).";
  if (form.tagline.trim().length < 8) return "Add a tagline (at least 8 characters).";
  if (form.bio.trim().length < 40) return "Write a short bio (at least 40 characters).";
  const rows = form.translations.filter((row) => row.before.trim() || row.now.trim());
  if (!rows.length) return "Add at least one translation.";
  if (rows.some((row) => row.before.trim().length < 4 || row.now.trim().length < 4)) {
    return "Each translation needs both sides, at least 4 characters each.";
  }
  if (form.handle.trim().length < 3) return "Pick a page address (at least 3 characters).";
  return null;
}

function Counter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={over ? styles.counterOver : styles.counter} aria-hidden="true">
      {value.length}/{max}
    </span>
  );
}

export function SiteEditor({ initial }: { initial: SiteEditorInitial }) {
  const formId = useId();
  const [site, setSite] = useState<ProofSite | null>(initial.site);
  const [published, setPublished] = useState(initial.profile.published);
  const [savedHandle, setSavedHandle] = useState(initial.profile.handle);
  const [form, setForm] = useState<FormState | null>(initial.site ? fromSite(initial.site, initial.profile.handle) : null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(form ? JSON.stringify(form) : null);
  const [busy, setBusy] = useState<null | "draft" | "save" | "publish" | "unpublish">(null);
  const [error, setError] = useState<string | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasMap = Boolean(initial.map?.map);
  const dirty = form ? JSON.stringify(form) !== savedSnapshot : false;
  const publicPath = `/u/${savedHandle}`;
  const publicUrl = `${initial.siteUrl}${publicPath}`;
  const mapTitle = useMemo(() => (initial.map?.map ? getCareerMapTitle(initial.map.map.primary.titleId)?.title ?? null : null), [initial.map]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setNotice(null);
    if (key === "handle") setHandleError(null);
  }

  function updateTranslation(index: number, key: keyof Translation, value: string) {
    setForm((current) => {
      if (!current) return current;
      const translations = current.translations.map((row, i) => (i === index ? { ...row, [key]: value } : row));
      return { ...current, translations };
    });
    setNotice(null);
  }

  async function draftFromMap() {
    setBusy("draft");
    setError(null);
    setNotice(null);
    const result = await callApi<{ draft: { tagline: string; bio: string; translations: Translation[] }; newTitle: string; previousRole: string }>(
      "/api/proof/site/draft",
      { method: "POST", body: "{}" },
    );
    setBusy(null);
    if (!result.ok) {
      setError(errorSentence(result.error, "draft"));
      return;
    }
    const { draft, newTitle, previousRole } = result.data;
    setForm((current) => ({
      handle: current?.handle ?? savedHandle,
      newTitle: current?.newTitle?.trim() ? current.newTitle : newTitle,
      previousRole: current?.previousRole?.trim() ? current.previousRole : previousRole,
      tagline: draft.tagline,
      bio: draft.bio,
      translations: draft.translations.map((row) => ({ ...row })),
      contactEmail: current?.contactEmail ?? "",
      linkedinUrl: current?.linkedinUrl ?? "",
    }));
    setNotice("Draft ready. Read it, change anything that is not quite you, then save.");
  }

  function startBlank() {
    setError(null);
    setForm(fromMap(initial.map, savedHandle));
  }

  async function save(): Promise<boolean> {
    if (!form) return false;
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return false;
    }
    setBusy("save");
    setError(null);
    setHandleError(null);
    const body = {
      handle: form.handle.trim().toLowerCase(),
      newTitle: form.newTitle.trim(),
      previousRole: form.previousRole.trim() || null,
      tagline: form.tagline.trim(),
      bio: form.bio.trim(),
      translations: form.translations
        .filter((row) => row.before.trim() || row.now.trim())
        .map((row) => ({ before: row.before.trim(), now: row.now.trim() })),
      contactEmail: form.contactEmail.trim() || null,
      linkedinUrl: form.linkedinUrl.trim() || null,
    };
    const result = await callApi<{ site: ProofSite; profile: { handle: string; published: boolean } }>("/api/proof/site", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!result.ok) {
      const sentence = errorSentence(result.error, "save");
      if (result.error.field === "handle") setHandleError(sentence);
      else setError(sentence);
      return false;
    }
    const next = fromSite(result.data.site, result.data.profile.handle);
    setSite(result.data.site);
    setSavedHandle(result.data.profile.handle);
    setPublished(result.data.profile.published);
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
    setNotice(result.data.profile.published ? "Saved. Your public page is updated." : "Saved. Preview it, then publish when you are ready.");
    return true;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await save();
  }

  async function publish() {
    if (dirty || !site) {
      const saved = await save();
      if (!saved) return;
    }
    setBusy("publish");
    setError(null);
    const result = await callApi<{ profile: { handle: string; published: boolean }; publicUrl: string }>("/api/profile/publish", {
      method: "POST",
      body: "{}",
    });
    setBusy(null);
    if (!result.ok) {
      setError(errorSentence(result.error, "publish"));
      return;
    }
    setPublished(true);
    setSavedHandle(result.data.profile.handle);
    setNotice("Published. Your page is live.");
    captureAnalyticsEvent("proof_site_published", { handle: result.data.profile.handle, source: "dashboard_proof_site" });
  }

  async function unpublish() {
    setBusy("unpublish");
    setError(null);
    const result = await callApi<{ profile: { published: boolean } }>("/api/proof/site/unpublish", { method: "POST", body: "{}" });
    setBusy(null);
    if (!result.ok) {
      setError(errorSentence(result.error, "unpublish"));
      return;
    }
    setPublished(false);
    setNotice("Unpublished. Your page is private again.");
  }

  const status = published ? "live" : site ? "draft" : "empty";

  return (
    <div className={styles.editor}>
      <div className={styles.intro}>
        <p className="rm-kicker">Proof Studio · Site</p>
        <h1 className="rm-h2">Your proof site</h1>
        <p className="rm-p">One public page with your new title, what your old work has become, and what you built. Employers can open it without an account.</p>
      </div>

      {status !== "empty" ? (
        <section className={`rm-card ${styles.statusCard}`} aria-label="Publish status" data-testid="proof-site-status" data-state={status}>
          <div className={styles.statusHead}>
            <span className={status === "live" ? "rm-chip rm-chip--green" : "rm-chip"}>{status === "live" ? "Live" : "Not published"}</span>
            <p className="rm-p">
              {status === "live" ? "Anyone with the link can see your page." : "Only you can see your page. Preview it, then publish."}
            </p>
          </div>
          {status === "live" ? (
            <div className={styles.urlRow}>
              <span className={styles.url} data-testid="proof-site-public-url">
                {publicUrl}
              </span>
              <SiteCopyButton value={publicUrl} label="Copy link" testId="proof-site-copy-link" />
            </div>
          ) : null}
          <div className={styles.buttonRow}>
            <a href={publicPath} target="_blank" rel="noreferrer" className="rm-btn rm-btn--secondary rm-btn--sm" data-testid="proof-site-view">
              {status === "live" ? "View page" : "Preview"}
            </a>
            {status === "live" ? (
              <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={unpublish} disabled={busy !== null} data-testid="proof-site-unpublish">
                {busy === "unpublish" ? "Unpublishing..." : "Unpublish"}
              </button>
            ) : (
              <button type="button" className="rm-btn rm-btn--primary rm-btn--sm" onClick={publish} disabled={busy !== null} data-testid="proof-site-publish" data-agent-action="publish-proof-site">
                {busy === "publish" || busy === "save" ? "Publishing..." : dirty ? "Save and publish" : "Publish"}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {notice ? (
        <p className="rm-alert rm-alert--success" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rm-alert rm-alert--error" role="alert" data-testid="proof-site-error">
          {error}
        </p>
      ) : null}

      {!form && !hasMap ? (
        <section className={`rm-card ${styles.emptyCard}`} data-testid="proof-site-no-map">
          <h2 className="rm-h3">Start with your career map</h2>
          <p className="rm-p">Your site is drafted from your career map: the new title it found and the lines of your résumé that back it up. It takes about a minute.</p>
          <div className={styles.buttonRow}>
            <a href="/map" className="rm-btn rm-btn--primary" data-agent-action="start-career-map">
              Map my career
            </a>
            <button type="button" className="rm-btn rm-btn--secondary" onClick={startBlank}>
              Write it myself
            </button>
          </div>
        </section>
      ) : null}

      {!form && hasMap ? (
        <section className={`rm-card ${styles.emptyCard}`} data-testid="proof-site-draft-offer">
          <h2 className="rm-h3">Draft your site from your map</h2>
          <p className="rm-p">
            {mapTitle ? `Your map points to ${mapTitle}. ` : ""}We write a tagline, a short bio and your translations from the map. Nothing goes live until you publish.
          </p>
          <div className={styles.buttonRow}>
            <button type="button" className="rm-btn rm-btn--primary" onClick={draftFromMap} disabled={busy !== null} data-testid="proof-site-draft" data-agent-action="draft-proof-site">
              {busy === "draft" ? "Drafting... (about 15 seconds)" : "Draft it from my map"}
            </button>
            <button type="button" className="rm-btn rm-btn--secondary" onClick={startBlank} disabled={busy !== null}>
              Write it myself
            </button>
          </div>
        </section>
      ) : null}

      {form ? (
        <form className={styles.form} onSubmit={onSubmit} aria-labelledby={`${formId}-title`} noValidate>
          <div className={styles.formHead}>
            <h2 id={`${formId}-title`} className="rm-h3">
              Page content
            </h2>
            {hasMap ? (
              <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={draftFromMap} disabled={busy !== null}>
                {busy === "draft" ? "Drafting..." : "Redraft from my map"}
              </button>
            ) : null}
          </div>

          <div className={styles.field}>
            <span className="rm-label">Name</span>
            <p className={styles.readonly}>{initial.profile.name}</p>
            <p className="rm-field-hint">Your name comes from your account. Change it in your account settings.</p>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className="rm-label" htmlFor={`${formId}-title-input`}>
                New title
              </label>
              <input id={`${formId}-title-input`} className="rm-input" value={form.newTitle} maxLength={LIMITS.newTitle} onChange={(e) => update("newTitle", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className="rm-label" htmlFor={`${formId}-previous`}>
                Previous role <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id={`${formId}-previous`}
                className="rm-input"
                value={form.previousRole}
                maxLength={LIMITS.previousRole}
                placeholder="Senior Marketing Manager at a game studio, 2018 to 2025"
                onChange={(e) => update("previousRole", e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className="rm-label" htmlFor={`${formId}-tagline`}>
                Tagline
              </label>
              <Counter value={form.tagline} max={LIMITS.tagline} />
            </div>
            <input id={`${formId}-tagline`} className="rm-input" value={form.tagline} maxLength={LIMITS.tagline} onChange={(e) => update("tagline", e.target.value)} />
            <p className="rm-field-hint">One sentence on what you do now. It sits under your name.</p>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className="rm-label" htmlFor={`${formId}-bio`}>
                Bio
              </label>
              <Counter value={form.bio} max={LIMITS.bio} />
            </div>
            <textarea id={`${formId}-bio`} className="rm-textarea" rows={5} value={form.bio} maxLength={LIMITS.bio} onChange={(e) => update("bio", e.target.value)} />
          </div>

          <fieldset className={styles.fieldset}>
            <legend className="rm-label">What your work has become</legend>
            <p className="rm-field-hint" style={{ marginTop: 0 }}>
              Left: what you did, in your own words. Right: the skill it is now.
            </p>
            <ol className={styles.translations}>
              {form.translations.map((row, index) => (
                <li key={index} className={styles.translationRow}>
                  <div className={styles.field}>
                    <label className="rm-label" htmlFor={`${formId}-before-${index}`}>
                      Before {index + 1}
                    </label>
                    <input id={`${formId}-before-${index}`} className="rm-input" value={row.before} maxLength={LIMITS.before} onChange={(e) => updateTranslation(index, "before", e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className="rm-label" htmlFor={`${formId}-now-${index}`}>
                      Now {index + 1}
                    </label>
                    <input id={`${formId}-now-${index}`} className="rm-input" value={row.now} maxLength={LIMITS.now} onChange={(e) => updateTranslation(index, "now", e.target.value)} />
                  </div>
                  <button
                    type="button"
                    className={`rm-btn rm-btn--secondary rm-btn--sm ${styles.removeButton}`}
                    onClick={() => update("translations", form.translations.filter((_, i) => i !== index))}
                    disabled={form.translations.length <= 1}
                    aria-label={`Remove translation ${index + 1}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
            {form.translations.length < MAX_TRANSLATIONS ? (
              <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => update("translations", [...form.translations, { before: "", now: "" }])}>
                Add a translation
              </button>
            ) : null}
          </fieldset>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className="rm-label" htmlFor={`${formId}-email`}>
                Contact email <span className={styles.optional}>(optional, shown on your page)</span>
              </label>
              <input id={`${formId}-email`} type="email" autoComplete="email" className="rm-input" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className="rm-label" htmlFor={`${formId}-linkedin`}>
                LinkedIn <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id={`${formId}-linkedin`}
                type="url"
                inputMode="url"
                className="rm-input"
                value={form.linkedinUrl}
                placeholder="linkedin.com/in/your-name"
                onChange={(e) => update("linkedinUrl", e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className="rm-label" htmlFor={`${formId}-handle`}>
              Page address
            </label>
            <div className={styles.handleRow}>
              <span className={styles.handlePrefix} aria-hidden="true">
                {initial.siteUrl.replace(/^https?:\/\//, "")}/u/
              </span>
              <input
                id={`${formId}-handle`}
                className="rm-input"
                value={form.handle}
                maxLength={40}
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={`${formId}-handle-hint`}
                aria-invalid={handleError ? true : undefined}
                onChange={(e) => update("handle", e.target.value.toLowerCase())}
              />
            </div>
            <p id={`${formId}-handle-hint`} className={handleError ? styles.fieldError : "rm-field-hint"} role={handleError ? "alert" : undefined}>
              {handleError ?? "Lower-case letters, numbers and dashes. Changing it changes your page link."}
            </p>
          </div>

          <div className={styles.saveRow}>
            <button type="submit" className="rm-btn rm-btn--primary" disabled={busy !== null || (!dirty && Boolean(site))} data-testid="proof-site-save">
              {busy === "save" ? "Saving..." : site && !dirty ? "Saved" : "Save"}
            </button>
            {dirty && site ? <span className="rm-small">You have unsaved changes.</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
