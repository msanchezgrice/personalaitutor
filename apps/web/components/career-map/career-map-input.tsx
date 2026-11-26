"use client";

import React, { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CAREER_MAP_INPUT_MAX_CHARS, type CareerMapSource } from "@aitutor/shared";
import { captureAnalyticsEvent, getOrCreateFunnelVisitorId } from "@/lib/analytics";
import { CAREER_MAP_DRAFT_STORAGE_KEY } from "@/lib/career-map/constants";
import {
  CAREER_MAP_UPLOAD_ACCEPT,
  careerMapProgressMessage,
  checkCareerMapInput,
  checkUploadFile,
  describeCareerMapError,
  formatCharacterCount,
  formatCount,
  parseCareerMapDraft,
  shouldAutoStart,
  type ApiErrorInput,
  type CareerMapErrorCopy,
} from "./input-helpers";
import styles from "./career-map.module.css";

/**
 * /map input flow: paste, upload (extract -> review -> edit) or describe,
 * then one POST to /api/career-map with an honest progress state while the
 * map is drawn, then a redirect to the map page.
 */

type Phase = "form" | "extracting" | "generating" | "redirecting";

type ApiFailure = { ok: false; error?: { code?: string; message?: string; reason?: string; retryAfterSeconds?: number } };
type GenerateSuccess = { ok: true; token: string; mapPath: string; view?: { map?: { primary?: { titleId?: string; fit?: string } } | null } };
type ExtractSuccess = { ok: true; text: string; chars: number; truncated: boolean };

const MODES: Array<{ id: CareerMapSource; label: string }> = [
  { id: "paste", label: "Paste résumé" },
  { id: "upload", label: "Upload a file" },
  { id: "describe", label: "Describe your last job" },
];

const PLACEHOLDERS: Record<CareerMapSource, string> = {
  paste: "Paste the text of your résumé here. Titles, bullet points and skills are all useful.",
  upload: "",
  describe:
    "What was your title? What did you do most weeks? What did you own, make or fix? What are you proud of?\n\nFor example: I was a senior producer at a mobile game studio for six years. I ran the release schedule for three live games...",
};

function retryAfterFrom(res: Response, body: ApiFailure | null): number | undefined {
  const fromBody = body?.error?.retryAfterSeconds;
  if (typeof fromBody === "number" && Number.isFinite(fromBody)) return fromBody;
  const header = Number(res.headers.get("retry-after"));
  return Number.isFinite(header) && header > 0 ? header : undefined;
}

async function readFailure(res: Response): Promise<ApiErrorInput> {
  const body = (await res.json().catch(() => null)) as ApiFailure | null;
  return {
    code: body?.error?.code ?? (res.status === 504 ? "TIMEOUT" : null),
    status: res.status,
    reason: body?.error?.reason ?? null,
    retryAfterSeconds: retryAfterFrom(res, body) ?? null,
  };
}

export type CareerMapInputProps = {
  /** `from` search param: "home" means the landing hero handed over a draft. */
  from?: string | null;
  /** `?upload=1` opens the upload flow. */
  startWithUpload?: boolean;
};

export function CareerMapInput({ from = null, startWithUpload = false }: CareerMapInputProps) {
  const router = useRouter();
  const [mode, setMode] = useState<CareerMapSource>(startWithUpload ? "upload" : "paste");
  const [texts, setTexts] = useState<Record<CareerMapSource, string>>({ paste: "", upload: "", describe: "" });
  const [upload, setUpload] = useState<{ fileName: string; truncated: boolean } | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<CareerMapErrorCopy | null>(null);
  const [touched, setTouched] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [retryAt, setRetryAt] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const text = texts[mode];
  const check = checkCareerMapInput(text);
  const showTextarea = mode !== "upload" || upload !== null;

  const setText = useCallback((value: string, target: CareerMapSource = mode) => {
    setTexts((current) => ({ ...current, [target]: value }));
  }, [mode]);

  const generate = useCallback(
    async (inputText: string, source: CareerMapSource) => {
      if (started.current) return;
      const local = checkCareerMapInput(inputText);
      if (!local.ok) {
        setTouched(true);
        setError(null);
        return;
      }
      started.current = true;
      setError(null);
      setPhase("generating");
      setElapsed(0);
      const startedAt = Date.now();
      captureAnalyticsEvent("career_map_started", { source, chars: local.chars });

      let failure: ApiErrorInput | null = null;
      try {
        const res = await fetch("/api/career-map", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ text: inputText.trim(), source, visitorId: getOrCreateFunnelVisitorId() ?? undefined }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as GenerateSuccess | ApiFailure | null;
          if (data && data.ok && typeof data.mapPath === "string" && data.mapPath.startsWith("/map/")) {
            captureAnalyticsEvent("career_map_completed", {
              source,
              chars: local.chars,
              seconds: Math.round((Date.now() - startedAt) / 1000),
              title_id: data.view?.map?.primary?.titleId ?? null,
              fit: data.view?.map?.primary?.fit ?? null,
            });
            setPhase("redirecting");
            router.push(data.mapPath as Route);
            return;
          }
          failure = { code: (data as ApiFailure | null)?.error?.code ?? null, status: res.status };
        } else {
          failure = await readFailure(res);
        }
      } catch {
        failure = { code: "NETWORK_ERROR", status: null };
      }

      const copy = describeCareerMapError(failure);
      captureAnalyticsEvent("career_map_failed", { source, chars: local.chars, code: copy.code, status: failure.status ?? null, seconds: Math.round((Date.now() - startedAt) / 1000) });
      started.current = false;
      setError(copy);
      setRetryAt(copy.retryAfterSeconds ? Date.now() + copy.retryAfterSeconds * 1000 : null);
      setPhase("form");
    },
    [router],
  );

  // Hero hand-off: read once, clear, maybe start.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(CAREER_MAP_DRAFT_STORAGE_KEY);
      window.sessionStorage.removeItem(CAREER_MAP_DRAFT_STORAGE_KEY);
    } catch {
      raw = null;
    }
    const draft = parseCareerMapDraft(raw);
    if (!draft) {
      if (startWithUpload) uploadButtonRef.current?.focus();
      return;
    }
    setMode(draft.source);
    setTexts((current) => ({ ...current, [draft.source]: draft.text }));
    if (shouldAutoStart(draft, from)) {
      void generate(draft.text, draft.source);
    } else {
      setTouched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Elapsed timer while generating.
  useEffect(() => {
    if (phase !== "generating" && phase !== "redirecting") return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    progressRef.current?.focus();
    return () => window.clearInterval(timer);
  }, [phase]);

  // Clock for the rate-limit countdown.
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  function chooseMode(next: CareerMapSource) {
    setMode(next);
    setTouched(false);
    if (error && error.action !== "wait") setError(null);
  }

  async function extract(file: File) {
    const pre = checkUploadFile(file);
    if (!pre.ok) {
      setError(describeCareerMapError({ code: pre.code }));
      return;
    }
    setError(null);
    setPhase("extracting");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/career-map/extract", { method: "POST", body: form, credentials: "same-origin" });
      if (!res.ok) {
        setError(describeCareerMapError(await readFailure(res)));
        setPhase("form");
        return;
      }
      const data = (await res.json().catch(() => null)) as ExtractSuccess | ApiFailure | null;
      if (!data || !data.ok || typeof data.text !== "string") {
        setError(describeCareerMapError({ code: (data as ApiFailure | null)?.error?.code ?? null, status: res.status }));
        setPhase("form");
        return;
      }
      setTexts((current) => ({ ...current, upload: data.text }));
      setUpload({ fileName: file.name, truncated: Boolean(data.truncated) });
      setTouched(true);
      setPhase("form");
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    } catch {
      setError(describeCareerMapError({ code: "NETWORK_ERROR" }));
      setPhase("form");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void extract(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void extract(file);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (retryAt && Date.now() < retryAt) return;
    void generate(text, mode);
  }

  function runErrorAction(copy: CareerMapErrorCopy) {
    switch (copy.action) {
      case "retry":
      case "wait":
        void generate(text, mode);
        return;
      case "edit":
        setError(null);
        textareaRef.current?.focus();
        return;
      case "upload":
        setError(null);
        setMode("upload");
        setUpload(null);
        window.setTimeout(() => fileInputRef.current?.click(), 0);
        return;
      case "paste":
        setError(null);
        setMode("paste");
        window.setTimeout(() => textareaRef.current?.focus(), 0);
        return;
      case "start-over":
        setError(null);
        setTexts({ paste: "", upload: "", describe: "" });
        setUpload(null);
        return;
    }
  }

  if (phase === "generating" || phase === "redirecting") {
    return (
      <div className={styles.formCard}>
        <div className={styles.progress} ref={progressRef} tabIndex={-1} aria-busy="true" data-testid="career-map-progress">
          <p className={styles.kicker}>Drawing your map</p>
          <div className={styles.progressTrack} aria-hidden="true">
            <span className={styles.progressDot} />
            <span className={styles.progressLine} />
            <span className={`${styles.progressDot} ${styles.progressDotNew}`} />
          </div>
          <p className={styles.progressMessage} role="status" aria-live="polite">
            {phase === "redirecting" ? "Your map is ready. Opening it now." : careerMapProgressMessage(elapsed)}
          </p>
          <p className={styles.progressMeta}>
            {elapsed} s so far. It usually takes 10 to 30 seconds. Keep this tab open.
          </p>
          <p className={styles.privacy}>Your résumé is used to draw the map and nothing else.</p>
        </div>
      </div>
    );
  }

  const waiting = Boolean(retryAt && now < retryAt);
  const counterClass = check.ok ? styles.counterOk : check.reason === "long" ? styles.counterOver : "";
  const fieldLabel = mode === "describe" ? "Describe your last job" : mode === "upload" ? "Check the text we pulled from your file" : "Your résumé";
  const textareaId = `career-map-text-${mode}`;
  const hintId = `${textareaId}-hint`;

  return (
    <form className={styles.formCard} onSubmit={onSubmit} noValidate data-testid="career-map-form">
      <fieldset className={styles.modes}>
        <legend className="rm-sr-only">How do you want to start?</legend>
        <div className={styles.modeList}>
          {MODES.map((entry) => (
            <span className={styles.mode} key={entry.id}>
              <input
                type="radio"
                name="career-map-mode"
                id={`career-map-mode-${entry.id}`}
                className={styles.modeInput}
                checked={mode === entry.id}
                onChange={() => chooseMode(entry.id)}
                data-testid={`career-map-mode-${entry.id}`}
              />
              <label htmlFor={`career-map-mode-${entry.id}`} className={styles.modeLabel}>
                {entry.label}
              </label>
            </span>
          ))}
        </div>
      </fieldset>

      {error ? (
        <div className={`rm-alert rm-alert--error ${styles.errorBox}`} role="alert" data-testid="career-map-error" data-error-code={error.code}>
          <p className={styles.errorTitle}>{error.title}</p>
          <p className={styles.errorText}>{error.message}</p>
          <div className={styles.errorActions}>
            <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => runErrorAction(error)} disabled={error.action === "wait" && waiting}>
              {error.action === "wait" && waiting && retryAt
                ? `Try again after ${new Date(retryAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : error.actionLabel}
            </button>
            {error.action === "upload" ? (
              <button type="button" className={styles.linkButton} onClick={() => runErrorAction({ ...error, action: "paste" })}>
                Paste the text instead
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <input ref={fileInputRef} type="file" accept={CAREER_MAP_UPLOAD_ACCEPT} className="rm-sr-only" tabIndex={-1} aria-hidden="true" onChange={onFileChange} data-testid="career-map-file" />

      {mode === "upload" && !upload ? (
        <div
          className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <h2 className={styles.fieldTitle}>Upload your résumé</h2>
          <p className="rm-p">PDF, Word (.docx) or plain text, up to 4 MB. We pull out the text and show it to you before anything else happens.</p>
          <button
            ref={uploadButtonRef}
            type="button"
            className="rm-btn rm-btn--secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={phase === "extracting"}
            data-testid="career-map-choose-file"
          >
            {phase === "extracting" ? "Reading your file" : "Choose a file"}
          </button>
          <p className="rm-small" role="status" aria-live="polite">
            {phase === "extracting" ? "Pulling the text out of your file. This takes a few seconds." : "Or drag a file here."}
          </p>
        </div>
      ) : null}

      {showTextarea ? (
        <div>
          <div className={styles.fieldHead}>
            <label htmlFor={textareaId} className={styles.fieldTitle}>
              {fieldLabel}
            </label>
            {mode === "upload" && upload ? (
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  setUpload(null);
                  setText("", "upload");
                  window.setTimeout(() => fileInputRef.current?.click(), 0);
                }}
              >
                Use a different file
              </button>
            ) : null}
          </div>
          {mode === "upload" && upload ? (
            <p className={styles.fileNote} style={{ marginBottom: 12 }}>
              From <strong>{upload.fileName}</strong>. Fix anything that came through wrong, and remove anything you would rather not send.
              {upload.truncated ? ` The file was longer than ${formatCount(CAREER_MAP_INPUT_MAX_CHARS)} characters, so we kept the first part.` : ""}
            </p>
          ) : null}
          <textarea
            ref={textareaRef}
            id={textareaId}
            className={`rm-textarea ${styles.textarea}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={PLACEHOLDERS[mode]}
            rows={mode === "describe" ? 9 : 12}
            spellCheck={mode === "describe"}
            aria-describedby={hintId}
            aria-invalid={touched && !check.ok ? true : undefined}
            data-testid="career-map-text"
          />
          <div className={styles.counterRow} id={hintId}>
            <span>{touched && !check.ok ? check.message : mode === "describe" ? "Plain sentences are fine. Specific beats polished." : "Remove your address and phone number if you like. We do not need them."}</span>
            <span className={counterClass} aria-live="polite">
              {formatCharacterCount(check.chars)}
            </span>
          </div>
        </div>
      ) : null}

      <div className={styles.formFooter}>
        <button type="submit" className="rm-btn rm-btn--primary rm-btn--lg" disabled={!showTextarea || phase === "extracting" || waiting} data-testid="career-map-submit" data-agent-action="generate-career-map">
          Map my career
        </button>
        <p className={styles.privacy}>Free. No account needed. Your résumé is used to draw the map and nothing else.</p>
      </div>
    </form>
  );
}
