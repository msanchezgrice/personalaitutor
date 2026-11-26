"use client";

import React, { useId, useState, type FormEvent } from "react";
import { VOICE_MODEL_PROMPT_MAX_CHARS } from "@aitutor/shared";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { voiceModelRunErrorMessage } from "@/lib/voice-model/format";
import styles from "./voice-model.module.css";

/**
 * Client island of the public "Try my model" section: one task, "Run both",
 * base and tuned output side by side. Shows the owner's saved comparison until
 * the visitor runs their own task.
 */

export type VoiceModelTryProps = {
  handle: string;
  slug: string;
  modelName: string;
  demoPrompt: string | null;
  demoBaseOutput: string | null;
  demoTunedOutput: string | null;
};

type Outputs = { baseOutput: string; tunedOutput: string };

export function VoiceModelTry(props: VoiceModelTryProps) {
  const inputId = useId();
  const hintId = useId();
  const hasDemo = Boolean(props.demoPrompt && props.demoBaseOutput && props.demoTunedOutput);
  const [prompt, setPrompt] = useState(props.demoPrompt ?? "");
  const [outputs, setOutputs] = useState<Outputs | null>(
    hasDemo ? { baseOutput: props.demoBaseOutput!, tunedOutput: props.demoTunedOutput! } : null,
  );
  const [source, setSource] = useState<"demo" | "visitor">("demo");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = prompt.trim();
  const canRun = !running && trimmed.length >= 3 && trimmed.length <= VOICE_MODEL_PROMPT_MAX_CHARS;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRun) {
      if (!running) setError(voiceModelRunErrorMessage({ status: 400, code: "INVALID_BODY" }));
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/voice-models/public/${encodeURIComponent(props.handle)}/${encodeURIComponent(props.slug)}/run`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: trimmed }),
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { ok: true; result: Outputs & { prompt: string }; refused: boolean }
        | { ok: false; error?: { code?: string; message?: string } }
        | null;
      if (!response.ok || !data || !data.ok) {
        const failure = data && !data.ok ? data.error : undefined;
        setError(voiceModelRunErrorMessage({ status: response.status, code: failure?.code, message: failure?.message }));
        return;
      }
      setOutputs({ baseOutput: data.result.baseOutput, tunedOutput: data.result.tunedOutput });
      setSource("visitor");
      captureAnalyticsEvent("voice_model_public_run", { handle: props.handle, model_slug: props.slug, refused: data.refused });
    } catch {
      setError(voiceModelRunErrorMessage({ status: 0 }));
    } finally {
      setRunning(false);
    }
  }

  return (
    <form className={styles.tryForm} onSubmit={onSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor={inputId} className={styles.fieldLabel}>
          What should it write?
        </label>
        <div className={styles.inputRow}>
          <input
            id={inputId}
            className="rm-input"
            type="text"
            value={prompt}
            maxLength={VOICE_MODEL_PROMPT_MAX_CHARS}
            placeholder="Describe a short piece of writing"
            aria-describedby={hintId}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button type="submit" className="rm-btn rm-btn--primary" disabled={running} data-testid="voice-model-run">
            {running ? "Running…" : "Run both"}
          </button>
        </div>
        <div className={styles.fieldFoot} id={hintId}>
          <span>Both models get the same task.</span>
          <span>
            {prompt.length}/{VOICE_MODEL_PROMPT_MAX_CHARS}
          </span>
        </div>
      </div>

      {error ? (
        <p className="rm-alert rm-alert--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.panes} aria-live="polite" aria-busy={running}>
        <div className={styles.pane}>
          <span className={styles.paneLabel}>Base model</span>
          {running ? (
            <p className={`${styles.paneEmpty} ${styles.pending}`}>Writing…</p>
          ) : outputs ? (
            <p className={styles.paneText}>{outputs.baseOutput}</p>
          ) : (
            <p className={styles.paneEmpty}>Run a task to see the untuned model.</p>
          )}
        </div>
        <div className={`${styles.pane} ${styles.paneTuned}`}>
          <span className={`${styles.paneLabel} ${styles.paneLabelTuned}`}>{props.modelName}</span>
          {running ? (
            <p className={`${styles.paneEmpty} ${styles.pending}`}>Writing…</p>
          ) : outputs ? (
            <p className={`${styles.paneText} ${styles.paneTextTuned}`}>{outputs.tunedOutput}</p>
          ) : (
            <p className={styles.paneEmpty}>Run a task to see the tuned model.</p>
          )}
        </div>
      </div>
      {outputs && source === "demo" && !running ? (
        <p className={styles.caption}>A saved run of the task above. Change it and run both to try your own.</p>
      ) : null}
    </form>
  );
}
