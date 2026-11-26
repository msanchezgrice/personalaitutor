"use client";

import React, { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import {
  VOICE_MODEL_MAX_SAMPLES,
  VOICE_MODEL_METHOD_LABEL,
  VOICE_MODEL_MIN_SAMPLES,
  VOICE_MODEL_PROMPT_MAX_CHARS,
  VOICE_MODEL_SAMPLE_MAX_CHARS,
  type VoiceModel,
  type VoiceModelRunResult,
  type VoiceModelSample,
} from "@aitutor/shared";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { formatVoiceModelDate, formatVoiceModelSamples, voiceModelRunErrorMessage } from "@/lib/voice-model/format";
import { splitVoiceSamples, voiceSamplePreview, VOICE_MODEL_SAMPLE_MIN_CHARS } from "@/lib/voice-model/samples";
import { VOICE_MODEL_NAME_MAX, VOICE_MODEL_PURPOSE_MAX, VOICE_MODEL_SAMPLE_TYPE_MAX } from "@/lib/voice-model/schemas";
import { slugifyVoiceModelName } from "@/lib/voice-model/slug";
import styles from "./voice-model.module.css";

/**
 * Dashboard studio for voice models (/dashboard/proof/model): name it, add
 * samples, tune, test base vs tuned, pick the public demo, publish.
 */

export type VoiceModelStudioProps = {
  initialModels: VoiceModel[];
  initialSamples: Record<string, VoiceModelSample[]>;
  prefill: { name: string; sampleType: string; summary: string } | null;
  handle: string;
  profilePublished: boolean;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string | null; message: string | null };

async function callApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const json = (await response.json().catch(() => null)) as
      | ({ ok: true } & T)
      | { ok: false; error?: { code?: string; message?: string } }
      | null;
    if (!response.ok || !json || !json.ok) {
      const failure = json && !json.ok ? json.error : undefined;
      return { ok: false, status: response.status, code: failure?.code ?? null, message: failure?.message ?? null };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, code: null, message: null };
  }
}

/** The server's own sentence when it wrote one for people, else a mapped sentence. */
function errorSentence(result: { status: number; code: string | null; message: string | null }, fallback: string) {
  const humanCodes = new Set([
    "VOICE_MODEL_SAMPLES_EMPTY",
    "VOICE_MODEL_SAMPLE_TOO_SHORT",
    "VOICE_MODEL_SAMPLE_TOO_LONG",
    "VOICE_MODEL_SAMPLE_LIMIT",
    "VOICE_MODEL_NOT_ENOUGH_SAMPLES",
    "VOICE_MODEL_DEMO_UNVERIFIED",
    "SUBSCRIPTION_REQUIRED",
  ]);
  if (result.code && humanCodes.has(result.code) && result.message) return result.message;
  if (result.status === 401 || result.status === 402 || result.code === "OPENAI_CONFIG_MISSING") {
    return voiceModelRunErrorMessage(result);
  }
  return fallback;
}

export function VoiceModelStudio(props: VoiceModelStudioProps) {
  const [models, setModels] = useState<VoiceModel[]>(props.initialModels);
  const [samples, setSamples] = useState<Record<string, VoiceModelSample[]>>(props.initialSamples);
  const [selectedId, setSelectedId] = useState<string | null>(props.initialModels[0]?.id ?? null);
  const [creating, setCreating] = useState(props.initialModels.length === 0);

  const selected = models.find((model) => model.id === selectedId) ?? null;

  function upsertModel(model: VoiceModel) {
    setModels((current) => {
      const exists = current.some((entry) => entry.id === model.id);
      return exists ? current.map((entry) => (entry.id === model.id ? model : entry)) : [model, ...current];
    });
  }

  function removeModel(id: string) {
    const rest = models.filter((model) => model.id !== id);
    setModels(rest);
    setSamples((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSelectedId(rest[0]?.id ?? null);
    setCreating(rest.length === 0);
  }

  return (
    <div className={styles.studio} data-testid="voice-model-studio">
      <div className={styles.studioTop}>
        <div className={styles.studioTitle}>
          <p className="rm-kicker">Proof Studio · Voice model</p>
          <h2 className="rm-h2">A model tuned on your own work</h2>
          <p className="rm-p" style={{ maxWidth: "40em" }}>
            Paste writing you did. We build a profile of your voice and give it to a base model with your examples, so
            visitors can compare it with the untuned model on your page. It is tuned in context, not fine-tuned.
          </p>
        </div>
        {models.length > 0 && !creating ? (
          <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => setCreating(true)}>
            New model
          </button>
        ) : null}
      </div>

      {models.length > 1 && !creating ? (
        <div className={styles.tabs} role="group" aria-label="Your models">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              className={styles.tab}
              aria-pressed={model.id === selectedId}
              onClick={() => setSelectedId(model.id)}
            >
              {model.name}
            </button>
          ))}
        </div>
      ) : null}

      {creating ? (
        <CreateModelCard
          prefill={models.length === 0 ? props.prefill : null}
          canCancel={models.length > 0}
          onCancel={() => setCreating(false)}
          onCreated={(model) => {
            upsertModel(model);
            setSamples((current) => ({ ...current, [model.id]: [] }));
            setSelectedId(model.id);
            setCreating(false);
          }}
        />
      ) : selected ? (
        <ModelWorkspace
          key={selected.id}
          model={selected}
          samples={samples[selected.id] ?? []}
          handle={props.handle}
          profilePublished={props.profilePublished}
          onModel={upsertModel}
          onSamples={(list) => setSamples((current) => ({ ...current, [selected.id]: list }))}
          onDeleted={() => removeModel(selected.id)}
        />
      ) : null}
    </div>
  );
}

// --- create ----------------------------------------------------------------

function CreateModelCard(props: {
  prefill: VoiceModelStudioProps["prefill"];
  canCancel: boolean;
  onCancel: () => void;
  onCreated: (model: VoiceModel) => void;
}) {
  const ids = { name: useId(), purpose: useId(), sampleType: useId() };
  const [name, setName] = useState(props.prefill?.name ?? "");
  const [purpose, setPurpose] = useState("");
  const [sampleType, setSampleType] = useState(props.prefill?.sampleType ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 3 && purpose.trim().length >= 3 && sampleType.trim().length >= 3;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) {
      setError("Fill in all three fields (at least 3 characters each).");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await callApi<{ model: VoiceModel }>("/api/voice-models", {
      method: "POST",
      body: { name: name.trim(), purpose: purpose.trim(), sampleType: sampleType.trim() },
    });
    setSaving(false);
    if (!result.ok) {
      setError(errorSentence(result, "The model was not created. Try again."));
      return;
    }
    props.onCreated(result.data.model);
  }

  return (
    <form className={`rm-card ${styles.step}`} onSubmit={onSubmit} noValidate data-testid="voice-model-create">
      <div className={styles.stepHead}>
        <h2 className="rm-h3">Name your model</h2>
        {props.prefill ? <span className="rm-chip rm-chip--green">Suggested by your career map</span> : null}
      </div>
      {props.prefill ? <p className="rm-p">{props.prefill.summary}</p> : null}
      <div className={styles.grid}>
        <div>
          <label className="rm-label" htmlFor={ids.name}>
            Name
          </label>
          <input
            id={ids.name}
            className="rm-input"
            value={name}
            maxLength={VOICE_MODEL_NAME_MAX}
            placeholder="maya-voice-v1"
            onChange={(event) => setName(event.target.value)}
          />
          <p className="rm-field-hint">
            Its address on your page: <strong>{slugifyVoiceModelName(name || "voice-model")}</strong>
          </p>
        </div>
        <div>
          <label className="rm-label" htmlFor={ids.purpose}>
            What it writes
          </label>
          <input
            id={ids.purpose}
            className="rm-input"
            value={purpose}
            maxLength={VOICE_MODEL_PURPOSE_MAX}
            placeholder="game launch announcements"
            onChange={(event) => setPurpose(event.target.value)}
          />
          <p className="rm-field-hint">Visitors can only ask it for this kind of writing.</p>
        </div>
        <div>
          <label className="rm-label" htmlFor={ids.sampleType}>
            What the samples are
          </label>
          <input
            id={ids.sampleType}
            className="rm-input"
            value={sampleType}
            maxLength={VOICE_MODEL_SAMPLE_TYPE_MAX}
            placeholder="launch emails"
            onChange={(event) => setSampleType(event.target.value)}
          />
          <p className="rm-field-hint">Shown on the model card, e.g. &ldquo;24 launch emails&rdquo;.</p>
        </div>
      </div>
      {error ? (
        <p className="rm-alert rm-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="submit" className="rm-btn rm-btn--primary" disabled={saving}>
          {saving ? "Creating…" : "Create model"}
        </button>
        {props.canCancel ? (
          <button type="button" className="rm-btn rm-btn--secondary" onClick={props.onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

// --- workspace ---------------------------------------------------------------

type WorkspaceProps = {
  model: VoiceModel;
  samples: VoiceModelSample[];
  handle: string;
  profilePublished: boolean;
  onModel: (model: VoiceModel) => void;
  onSamples: (samples: VoiceModelSample[]) => void;
  onDeleted: () => void;
};

function statusLabel(model: VoiceModel) {
  if (model.published && model.status === "ready") return { text: "Live", green: true };
  if (model.status === "ready") return { text: "Tuned", green: true };
  return { text: "Draft", green: false };
}

function ModelWorkspace(props: WorkspaceProps) {
  const { model } = props;
  const status = statusLabel(model);
  return (
    <div className="rm-stack" style={{ gap: 24 }}>
      <DetailsCard model={model} status={status} onModel={props.onModel} onDeleted={props.onDeleted} />
      <SamplesCard model={model} samples={props.samples} onModel={props.onModel} onSamples={props.onSamples} />
      <TuneCard model={model} samples={props.samples} onModel={props.onModel} />
      {model.status === "ready" && model.styleProfile ? <TestCard model={model} onModel={props.onModel} /> : null}
      <PublishCard model={model} handle={props.handle} profilePublished={props.profilePublished} onModel={props.onModel} />
    </div>
  );
}

function DetailsCard(props: {
  model: VoiceModel;
  status: { text: string; green: boolean };
  onModel: (model: VoiceModel) => void;
  onDeleted: () => void;
}) {
  const { model } = props;
  const ids = { name: useId(), purpose: useId(), sampleType: useId() };
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(model.name);
  const [purpose, setPurpose] = useState(model.purpose);
  const [sampleType, setSampleType] = useState(model.sampleType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await callApi<{ model: VoiceModel }>(`/api/voice-models/${model.id}`, {
      method: "PATCH",
      body: { name: name.trim(), purpose: purpose.trim(), sampleType: sampleType.trim() },
    });
    setBusy(false);
    if (!result.ok) {
      setError(errorSentence(result, "Changes were not saved. Each field needs at least 3 characters."));
      return;
    }
    props.onModel(result.data.model);
    setEditing(false);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await callApi<{ deleted: boolean }>(`/api/voice-models/${model.id}`, { method: "DELETE" });
    setBusy(false);
    if (!result.ok) {
      setError(errorSentence(result, "The model was not deleted. Try again."));
      return;
    }
    props.onDeleted();
  }

  return (
    <section className={`rm-card ${styles.step}`} aria-labelledby={`${ids.name}-heading`}>
      <div className={styles.stepHead}>
        <h2 className="rm-h3" id={`${ids.name}-heading`}>
          {model.name}
        </h2>
        <span className={`rm-chip ${props.status.green ? "rm-chip--green" : ""} ${styles.statusChip}`} data-testid="voice-model-status">
          {props.status.text}
        </span>
      </div>
      {editing ? (
        <form className="rm-stack" onSubmit={save} noValidate>
          <div className={styles.grid}>
            <div>
              <label className="rm-label" htmlFor={ids.name}>
                Name
              </label>
              <input id={ids.name} className="rm-input" value={name} maxLength={VOICE_MODEL_NAME_MAX} onChange={(event) => setName(event.target.value)} />
              <p className="rm-field-hint">The address ({model.slug}) stays the same.</p>
            </div>
            <div>
              <label className="rm-label" htmlFor={ids.purpose}>
                What it writes
              </label>
              <input id={ids.purpose} className="rm-input" value={purpose} maxLength={VOICE_MODEL_PURPOSE_MAX} onChange={(event) => setPurpose(event.target.value)} />
            </div>
            <div>
              <label className="rm-label" htmlFor={ids.sampleType}>
                What the samples are
              </label>
              <input id={ids.sampleType} className="rm-input" value={sampleType} maxLength={VOICE_MODEL_SAMPLE_TYPE_MAX} onChange={(event) => setSampleType(event.target.value)} />
            </div>
          </div>
          <div className={styles.actions}>
            <button type="submit" className="rm-btn rm-btn--primary rm-btn--sm" disabled={busy}>
              {busy ? "Saving…" : "Save details"}
            </button>
            <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="rm-p">
            Writes {model.purpose}. Samples are {model.sampleType}. Address: <strong>{model.slug}</strong>
          </p>
          <div className={styles.actions}>
            <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => setEditing(true)}>
              Edit details
            </button>
            {confirmDelete ? (
              <>
                <span className="rm-small">Delete {model.name} and all {model.sampleCount} samples?</span>
                <button type="button" className={`rm-btn rm-btn--secondary rm-btn--sm ${styles.danger}`} disabled={busy} onClick={remove}>
                  {busy ? "Deleting…" : "Yes, delete"}
                </button>
                <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </>
            ) : (
              <button type="button" className={`rm-btn rm-btn--secondary rm-btn--sm ${styles.danger}`} onClick={() => setConfirmDelete(true)}>
                Delete model
              </button>
            )}
          </div>
        </>
      )}
      {error ? (
        <p className="rm-alert rm-alert--error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SamplesCard(props: {
  model: VoiceModel;
  samples: VoiceModelSample[];
  onModel: (model: VoiceModel) => void;
  onSamples: (samples: VoiceModelSample[]) => void;
}) {
  const { model, samples } = props;
  const textareaId = useId();
  const hintId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pieces = useMemo(() => splitVoiceSamples(text), [text]);
  const count = samples.length;
  const room = VOICE_MODEL_MAX_SAMPLES - count;
  const needed = Math.max(0, VOICE_MODEL_MIN_SAMPLES - count);
  const tooLong = pieces.findIndex((piece) => piece.length > VOICE_MODEL_SAMPLE_MAX_CHARS);
  const pct = Math.min(100, Math.round((count / VOICE_MODEL_MAX_SAMPLES) * 100));

  let pasteHint: string;
  if (pieces.length === 0) pasteHint = "Paste one piece, or several separated by a line with only ---.";
  else if (tooLong >= 0) {
    pasteHint = `${pieces.length === 1 ? "This sample" : `Sample ${tooLong + 1}`} is over ${VOICE_MODEL_SAMPLE_MAX_CHARS.toLocaleString("en-US")} characters. Split it with a line of ---.`;
  } else if (pieces.length > room) pasteHint = `This adds ${pieces.length} samples, but there is room for ${room}.`;
  else pasteHint = `This adds ${pieces.length} ${pieces.length === 1 ? "sample" : "samples"}.`;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pieces.length === 0) {
      setError("Paste at least one piece of your writing.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await callApi<{ model: VoiceModel; samples: VoiceModelSample[] }>(`/api/voice-models/${model.id}/samples`, {
      method: "POST",
      body: { text },
    });
    setBusy(false);
    if (!result.ok) {
      setError(errorSentence(result, "The samples were not saved. Try again."));
      return;
    }
    props.onModel(result.data.model);
    props.onSamples([...samples, ...result.data.samples]);
    setText("");
    setNotice(`Added ${result.data.samples.length} ${result.data.samples.length === 1 ? "sample" : "samples"}.`);
  }

  async function remove(sampleId: string) {
    setRemoving(sampleId);
    setError(null);
    setNotice(null);
    const result = await callApi<{ model: VoiceModel }>(`/api/voice-models/${model.id}/samples/${sampleId}`, { method: "DELETE" });
    setRemoving(null);
    if (!result.ok) {
      setError(errorSentence(result, "The sample was not removed. Try again."));
      return;
    }
    props.onModel(result.data.model);
    props.onSamples(samples.filter((sample) => sample.id !== sampleId));
  }

  return (
    <section className={`rm-card ${styles.step}`} aria-labelledby={`${textareaId}-heading`}>
      <div className={styles.stepHead}>
        <h2 className="rm-h4" id={`${textareaId}-heading`}>
          <span className={styles.stepNumber}>1</span>Add your writing
        </h2>
        <span className="rm-small" data-testid="voice-model-sample-count">
          {count} of {VOICE_MODEL_MAX_SAMPLES} samples · at least {VOICE_MODEL_MIN_SAMPLES} to tune
        </span>
      </div>
      <div className={styles.meter} aria-hidden="true">
        <div className={`${styles.meterFill} ${needed > 0 ? styles.meterFillShort : ""}`} style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }} />
      </div>
      <p className="rm-p">
        Use {model.sampleType} you wrote yourself. Each sample can be up to {VOICE_MODEL_SAMPLE_MAX_CHARS.toLocaleString("en-US")} characters
        and at least {VOICE_MODEL_SAMPLE_MIN_CHARS}. They stay private: visitors only see what the model writes.
      </p>
      {room > 0 ? (
        <form className="rm-stack" onSubmit={add} noValidate>
          <div>
            <label className="rm-label" htmlFor={textareaId}>
              Paste samples
            </label>
            <textarea
              id={textareaId}
              className="rm-textarea"
              rows={8}
              value={text}
              aria-describedby={hintId}
              placeholder={"First email...\n---\nSecond email..."}
              onChange={(event) => setText(event.target.value)}
            />
            <p className="rm-field-hint" id={hintId} aria-live="polite">
              {pasteHint}
            </p>
          </div>
          <div className={styles.actions}>
            <button type="submit" className="rm-btn rm-btn--primary rm-btn--sm" disabled={busy || pieces.length === 0}>
              {busy ? "Saving…" : pieces.length > 1 ? `Add ${pieces.length} samples` : "Add sample"}
            </button>
          </div>
        </form>
      ) : (
        <p className="rm-alert">This model has the maximum of {VOICE_MODEL_MAX_SAMPLES} samples. Remove one to add another.</p>
      )}
      {error ? (
        <p className="rm-alert rm-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rm-alert rm-alert--success" role="status">
          {notice} {needed > 0 ? `Add ${needed} more to tune.` : ""}
        </p>
      ) : null}
      {samples.length > 0 ? (
        <ul className={styles.sampleList} aria-label="Your samples">
          {samples.map((sample, index) => (
            <li key={sample.id} className={styles.sampleItem}>
              <div className={styles.sampleText}>
                <span className={styles.samplePreview}>
                  {index + 1}. {sample.title || voiceSamplePreview(sample.content)}
                </span>
                <span className="rm-small">{sample.content.length.toLocaleString("en-US")} characters</span>
              </div>
              <button
                type="button"
                className={styles.linkButton}
                disabled={removing === sample.id}
                aria-label={`Remove sample ${index + 1}`}
                onClick={() => remove(sample.id)}
              >
                {removing === sample.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const TUNE_STEPS = [
  { label: "Reading your samples", from: 0 },
  { label: "Writing your voice profile", from: 4 },
  { label: "Running a first comparison", from: 11 },
];

function TuneCard(props: { model: VoiceModel; samples: VoiceModelSample[]; onModel: (model: VoiceModel) => void }) {
  const { model, samples } = props;
  const headingId = useId();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  const needed = Math.max(0, VOICE_MODEL_MIN_SAMPLES - samples.length);
  const addedSinceTune = model.tunedAt ? samples.filter((sample) => sample.createdAt > model.tunedAt!).length : 0;
  const tuned = model.status === "ready" && model.styleProfile;

  async function tune() {
    setRunning(true);
    setError(null);
    setNotice(null);
    const result = await callApi<{ model: VoiceModel; samplesRead: number; demoSaved: boolean; demoMessage: string | null }>(
      `/api/voice-models/${model.id}/tune`,
      { method: "POST" },
    );
    setRunning(false);
    if (!result.ok) {
      setError(errorSentence(result, "Tuning did not finish and nothing was changed. Try again in a minute."));
      return;
    }
    props.onModel(result.data.model);
    const read = result.data.samplesRead;
    const total = result.data.model.sampleCount;
    setNotice(
      [
        read < total ? `Tuned. The profile was written from ${read} of your ${total} samples (the rest did not fit).` : "Tuned.",
        result.data.demoMessage ?? (result.data.demoSaved ? "A first comparison is saved as your public demo." : ""),
      ]
        .filter(Boolean)
        .join(" "),
    );
    captureAnalyticsEvent("voice_model_tuned", {
      model_slug: result.data.model.slug,
      sample_count: total,
      retune: Boolean(model.tunedAt),
    });
  }

  const activeStep = TUNE_STEPS.reduce((index, step, current) => (elapsed >= step.from ? current : index), 0);

  return (
    <section className={`rm-card ${styles.step}`} aria-labelledby={headingId}>
      <div className={styles.stepHead}>
        <h2 className="rm-h4" id={headingId}>
          <span className={styles.stepNumber}>2</span>Tune it
        </h2>
        {model.tunedAt ? <span className="rm-small">Last tuned {formatVoiceModelDate(model.tunedAt)}</span> : null}
      </div>
      <p className="rm-p">
        Tuning reads your samples and writes a profile of your voice: tone, habits and what you avoid. It describes your
        style and never copies your sentences. Method: {VOICE_MODEL_METHOD_LABEL.toLowerCase()}.
      </p>
      {addedSinceTune > 0 && !running ? (
        <p className="rm-alert">
          You added {addedSinceTune} {addedSinceTune === 1 ? "sample" : "samples"} since the last tune. Tune again to update the profile.
        </p>
      ) : null}
      {running ? (
        <div className="rm-stack" role="status" aria-live="polite" style={{ gap: 12 }}>
          <ol className={styles.progress}>
            {TUNE_STEPS.map((step, index) => (
              <li
                key={step.label}
                className={`${styles.progressItem} ${index === activeStep ? styles.progressItemActive : ""} ${index < activeStep ? styles.progressItemDone : ""}`}
              >
                <span
                  className={`rm-dot ${index < activeStep ? "rm-dot--arrived" : index === activeStep ? `rm-dot--new ${styles.pending}` : "rm-dot--closed"}`}
                  aria-hidden="true"
                />
                {step.label}
              </li>
            ))}
          </ol>
          <p className="rm-small">
            {elapsed}s · usually 10 to 20 seconds. Keep this page open.
          </p>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className="rm-btn rm-btn--primary"
            disabled={needed > 0}
            onClick={tune}
            data-testid="voice-model-tune"
          >
            {tuned ? "Tune again" : "Tune model"}
          </button>
          {needed > 0 ? (
            <span className="rm-small">
              Add {needed} more {needed === 1 ? "sample" : "samples"} first.
            </span>
          ) : null}
        </div>
      )}
      {error ? (
        <p className="rm-alert rm-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rm-alert rm-alert--success" role="status">
          {notice}
        </p>
      ) : null}
      {tuned && model.styleProfile ? (
        <div className={styles.profile} data-testid="voice-model-profile">
          <div style={{ gridColumn: "1 / -1" }}>
            <h3 className="rm-label">Your voice, as the model sees it</h3>
            <p className="rm-p">{model.styleProfile.summary}</p>
            <div className={styles.chipRow}>
              {model.styleProfile.tone.map((tone) => (
                <span key={tone} className="rm-chip">
                  {tone}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="rm-label">Habits</h3>
            <ul className={styles.profileList}>
              {model.styleProfile.habits.map((habit) => (
                <li key={habit}>{habit}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="rm-label">Avoids</h3>
            <ul className={styles.profileList}>
              {model.styleProfile.avoid.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
          {model.styleProfile.signaturePhrases.length > 0 ? (
            <div>
              <h3 className="rm-label">Phrases you reuse</h3>
              <ul className={styles.profileList}>
                {model.styleProfile.signaturePhrases.map((phrase) => (
                  <li key={phrase}>{phrase}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Panes(props: { modelName: string; baseOutput: string; tunedOutput: string }) {
  return (
    <div className={styles.panes}>
      <div className={styles.pane}>
        <span className={styles.paneLabel}>Base model</span>
        <p className={styles.paneText}>{props.baseOutput}</p>
      </div>
      <div className={`${styles.pane} ${styles.paneTuned}`}>
        <span className={`${styles.paneLabel} ${styles.paneLabelTuned}`}>{props.modelName}</span>
        <p className={`${styles.paneText} ${styles.paneTextTuned}`}>{props.tunedOutput}</p>
      </div>
    </div>
  );
}

function TestCard(props: { model: VoiceModel; onModel: (model: VoiceModel) => void }) {
  const { model } = props;
  const inputId = useId();
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [run, setRun] = useState<{ result: VoiceModelRunResult; refused: boolean; signature: string | null } | null>(null);

  const trimmed = prompt.trim();
  const isDemo =
    run !== null &&
    model.demoPrompt === run.result.prompt &&
    model.demoBaseOutput === run.result.baseOutput &&
    model.demoTunedOutput === run.result.tunedOutput;

  async function onRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmed.length < 3) {
      setError(voiceModelRunErrorMessage({ status: 400, code: "INVALID_BODY" }));
      return;
    }
    setRunning(true);
    setError(null);
    setNotice(null);
    const result = await callApi<{ result: VoiceModelRunResult; refused: boolean; signature: string | null }>(
      `/api/voice-models/${model.id}/run`,
      { method: "POST", body: { prompt: trimmed } },
    );
    setRunning(false);
    if (!result.ok) {
      setError(voiceModelRunErrorMessage(result));
      return;
    }
    setRun(result.data);
  }

  async function saveDemo() {
    if (!run || !run.signature) return;
    setSaving(true);
    setError(null);
    const result = await callApi<{ model: VoiceModel }>(`/api/voice-models/${model.id}`, {
      method: "PATCH",
      body: { demo: { ...run.result, signature: run.signature } },
    });
    setSaving(false);
    if (!result.ok) {
      setError(errorSentence(result, "The demo was not saved. Try again."));
      return;
    }
    props.onModel(result.data.model);
    setNotice("Saved. Visitors see this comparison before they run their own.");
  }

  return (
    <section className={`rm-card ${styles.step}`} aria-labelledby={`${inputId}-heading`}>
      <div className={styles.stepHead}>
        <h2 className="rm-h4" id={`${inputId}-heading`}>
          <span className={styles.stepNumber}>3</span>Test it and pick your demo
        </h2>
      </div>
      <form className={styles.tryForm} onSubmit={onRun} noValidate style={{ flex: "none" }}>
        <div className={styles.field}>
          <label htmlFor={inputId} className={styles.fieldLabel}>
            What should it write?
          </label>
          <div className={styles.inputRow}>
            <input
              id={inputId}
              className="rm-input"
              value={prompt}
              maxLength={VOICE_MODEL_PROMPT_MAX_CHARS}
              placeholder={model.demoPrompt ?? `A task for ${model.purpose}`}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <button type="submit" className="rm-btn rm-btn--primary" disabled={running} data-testid="voice-model-test-run">
              {running ? "Running…" : "Run both"}
            </button>
          </div>
          <div className={styles.fieldFoot}>
            <span>Same task, same base model. Only the tuned side gets your voice.</span>
            <span>
              {prompt.length}/{VOICE_MODEL_PROMPT_MAX_CHARS}
            </span>
          </div>
        </div>
      </form>
      {running ? (
        <p className={`rm-small ${styles.pending}`} role="status">
          Running both models…
        </p>
      ) : null}
      {error ? (
        <p className="rm-alert rm-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {run && !running ? (
        <div className="rm-stack" aria-live="polite">
          <Panes modelName={model.name} baseOutput={run.result.baseOutput} tunedOutput={run.result.tunedOutput} />
          {run.refused ? (
            <p className="rm-small">This task is outside what the model writes, so both sides refused. Visitors get the same answer.</p>
          ) : (
            <div className={styles.actions}>
              <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" disabled={saving || isDemo} onClick={saveDemo}>
                {isDemo ? "This is your public demo" : saving ? "Saving…" : "Use as my public demo"}
              </button>
            </div>
          )}
        </div>
      ) : null}
      {notice ? (
        <p className="rm-alert rm-alert--success" role="status">
          {notice}
        </p>
      ) : null}
      <div className="rm-stack" style={{ gap: 10 }}>
        <h3 className="rm-label">What visitors see first</h3>
        {model.demoPrompt && model.demoBaseOutput && model.demoTunedOutput ? (
          <>
            <p className="rm-small">Task: {model.demoPrompt}</p>
            <Panes modelName={model.name} baseOutput={model.demoBaseOutput} tunedOutput={model.demoTunedOutput} />
          </>
        ) : (
          <p className="rm-small">No saved comparison yet. Run a task above and use it as your demo.</p>
        )}
      </div>
    </section>
  );
}

function PublishCard(props: { model: VoiceModel; handle: string; profilePublished: boolean; onModel: (model: VoiceModel) => void }) {
  const { model } = props;
  const headingId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tuned = model.status === "ready" && Boolean(model.styleProfile);
  const pagePath = `/u/${props.handle}`;

  async function setPublished(published: boolean) {
    setBusy(true);
    setError(null);
    const result = await callApi<{ model: VoiceModel }>(`/api/voice-models/${model.id}/publish`, {
      method: "POST",
      body: { published },
    });
    setBusy(false);
    if (!result.ok) {
      setError(errorSentence(result, "That did not save. Try again."));
      return;
    }
    props.onModel(result.data.model);
    if (published) captureAnalyticsEvent("voice_model_published", { model_slug: result.data.model.slug, sample_count: result.data.model.sampleCount });
  }

  return (
    <section className={`rm-card ${styles.step}`} aria-labelledby={headingId}>
      <div className={styles.stepHead}>
        <h2 className="rm-h4" id={headingId}>
          <span className={styles.stepNumber}>{tuned ? 4 : 3}</span>Publish
        </h2>
      </div>
      {!tuned ? (
        <p className="rm-p">Tune the model first. Then you can put it on your page.</p>
      ) : model.published ? (
        <p className="rm-p">
          {props.profilePublished ? (
            <>
              Live on your page. Visitors can try it at <a href={`${pagePath}#model-${model.slug}`}>{pagePath}</a>.
            </>
          ) : (
            <>
              Published, but your page is not public yet. It will show at {pagePath} once you publish your site in{" "}
              <a href="/dashboard/proof/site">Proof Studio</a>.
            </>
          )}
        </p>
      ) : (
        <p className="rm-p">
          Publishing adds a &ldquo;Try my model&rdquo; section to your page with your saved demo and the model card:{" "}
          {model.baseModel ?? "the base model"}, {VOICE_MODEL_METHOD_LABEL.toLowerCase()},{" "}
          {formatVoiceModelSamples(model.sampleCount, model.sampleType)}.
        </p>
      )}
      {tuned ? (
        <div className={styles.actions}>
          {model.published ? (
            <button type="button" className="rm-btn rm-btn--secondary" disabled={busy} onClick={() => setPublished(false)} data-testid="voice-model-unpublish">
              {busy ? "Saving…" : "Unpublish"}
            </button>
          ) : (
            <button type="button" className="rm-btn rm-btn--primary" disabled={busy} onClick={() => setPublished(true)} data-testid="voice-model-publish">
              {busy ? "Publishing…" : "Publish model"}
            </button>
          )}
        </div>
      ) : null}
      {error ? (
        <p className="rm-alert rm-alert--error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
