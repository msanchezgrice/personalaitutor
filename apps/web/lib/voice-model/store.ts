import "server-only";

import { randomUUID } from "node:crypto";
import {
  VOICE_MODEL_MAX_SAMPLES,
  VOICE_MODEL_METHOD_LABEL,
  VOICE_MODEL_MIN_SAMPLES,
  voiceStyleProfileSchema,
  type ProofPieceStatus,
  type VoiceModel,
  type VoiceModelPublic,
  type VoiceModelSample,
  type VoiceStyleProfile,
} from "@aitutor/shared";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { slugifyVoiceModelName, uniqueVoiceModelSlug } from "@/lib/voice-model/slug";

/**
 * Voice model persistence (Proof Studio, workstream E). Dual mode like
 * `lib/anonymous-assessment.ts`: memory for tests and local dev, Supabase
 * (service role) in production.
 *
 * Tables (migration 20261126030000): `voice_models`, `voice_model_samples`
 * (cascade on model delete) and `voice_model_runs` (every comparison run, used
 * for the public rate limit).
 *
 * Rules kept here so every caller gets them:
 *  - The slug is derived from the name at creation, unique per learner, and
 *    never changes afterwards (it is the public URL of the model).
 *  - `sampleCount` always equals the number of stored samples.
 *  - A tuned model that drops below VOICE_MODEL_MIN_SAMPLES goes back to draft
 *    and is unpublished: it no longer has enough writing behind it.
 *  - Only `status = ready` models can be published.
 */

export type VoiceModelRunSource = "owner" | "public";

export type VoiceModelRun = {
  id: string;
  voiceModelId: string;
  source: VoiceModelRunSource;
  ipHash: string | null;
  prompt: string;
  createdAt: string;
};

type PersistenceMode = "memory" | "supabase";

function mode(): PersistenceMode {
  const explicit = process.env.PERSISTENCE_MODE?.toLowerCase();
  if (explicit === "supabase" || explicit === "memory") return explicit;
  if (explicit) {
    throw new Error("PERSISTENCE_MODE_INVALID");
  }
  const hasSupabaseCreds = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
  );
  if (hasSupabaseCreds) return "supabase";
  throw new Error("PERSISTENCE_MODE_REQUIRED");
}

const nowIso = () => new Date().toISOString();

// --- memory mode -----------------------------------------------------------

const memoryModels = new Map<string, VoiceModel>();
const memorySamples = new Map<string, VoiceModelSample & { learnerProfileId: string }>();
const memoryRuns: VoiceModelRun[] = [];
let lastSampleMs = 0;

export function resetVoiceModelStateForTests(): void {
  memoryModels.clear();
  memorySamples.clear();
  memoryRuns.length = 0;
  lastSampleMs = 0;
}

// --- supabase row mapping ---------------------------------------------------

const MODEL_SELECT_FIELDS =
  "id, learner_profile_id, slug, name, purpose, sample_type, status, published, style_profile, base_model, sample_count, demo_prompt, demo_base_output, demo_tuned_output, tuned_at, created_at, updated_at";
const SAMPLE_SELECT_FIELDS = "id, voice_model_id, title, content, created_at";
const RUN_SELECT_FIELDS = "id, voice_model_id, source, ip_hash, prompt, created_at";

type VoiceModelRow = {
  id: string;
  learner_profile_id: string;
  slug: string;
  name: string;
  purpose: string | null;
  sample_type: string | null;
  status: string;
  published: boolean;
  style_profile: unknown;
  base_model: string | null;
  sample_count: number | null;
  demo_prompt: string | null;
  demo_base_output: string | null;
  demo_tuned_output: string | null;
  tuned_at: string | null;
  created_at: string;
  updated_at: string;
};

type VoiceModelSampleRow = {
  id: string;
  voice_model_id: string;
  title: string | null;
  content: string;
  created_at: string;
};

type VoiceModelRunRow = {
  id: string;
  voice_model_id: string;
  source: string;
  ip_hash: string | null;
  prompt: string;
  created_at: string;
};

function parseStoredProfile(value: unknown): VoiceStyleProfile | null {
  if (!value) return null;
  const parsed = voiceStyleProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function modelFromRow(row: VoiceModelRow): VoiceModel {
  return {
    id: row.id,
    learnerProfileId: row.learner_profile_id,
    slug: row.slug,
    name: row.name,
    purpose: row.purpose ?? "",
    sampleType: row.sample_type ?? "",
    status: row.status === "ready" ? "ready" : "draft",
    published: Boolean(row.published),
    styleProfile: parseStoredProfile(row.style_profile),
    baseModel: row.base_model,
    sampleCount: row.sample_count ?? 0,
    demoPrompt: row.demo_prompt,
    demoBaseOutput: row.demo_base_output,
    demoTunedOutput: row.demo_tuned_output,
    tunedAt: row.tuned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sampleFromRow(row: VoiceModelSampleRow): VoiceModelSample {
  return {
    id: row.id,
    voiceModelId: row.voice_model_id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
  };
}

function runFromRow(row: VoiceModelRunRow): VoiceModelRun {
  return {
    id: row.id,
    voiceModelId: row.voice_model_id,
    source: row.source === "public" ? "public" : "owner",
    ipHash: row.ip_hash,
    prompt: row.prompt,
    createdAt: row.created_at,
  };
}

const copyModel = (model: VoiceModel): VoiceModel => ({
  ...model,
  styleProfile: model.styleProfile ? structuredClone(model.styleProfile) : null,
});

const copySample = (sample: VoiceModelSample & { learnerProfileId?: string }): VoiceModelSample => ({
  id: sample.id,
  voiceModelId: sample.voiceModelId,
  title: sample.title,
  content: sample.content,
  createdAt: sample.createdAt,
});

/** Newest first, ties broken by id so ordering is stable. */
const byCreatedDesc = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

// --- public shape -----------------------------------------------------------

export function toVoiceModelPublic(model: VoiceModel): VoiceModelPublic {
  return {
    slug: model.slug,
    name: model.name,
    purpose: model.purpose,
    sampleType: model.sampleType,
    baseModel: model.baseModel,
    sampleCount: model.sampleCount,
    demoPrompt: model.demoPrompt,
    demoBaseOutput: model.demoBaseOutput,
    demoTunedOutput: model.demoTunedOutput,
    tunedAt: model.tunedAt,
    methodLabel: VOICE_MODEL_METHOD_LABEL,
  };
}

/** A model visitors may see and run: published, tuned, with a profile and enough samples. */
export function isVoiceModelPubliclyRunnable(model: VoiceModel): boolean {
  return (
    model.published &&
    model.status === "ready" &&
    model.styleProfile !== null &&
    model.sampleCount >= VOICE_MODEL_MIN_SAMPLES
  );
}

// --- models -----------------------------------------------------------------

export async function listVoiceModelsForProfile(learnerProfileId: string): Promise<VoiceModel[]> {
  if (mode() === "memory") {
    return [...memoryModels.values()]
      .filter((model) => model.learnerProfileId === learnerProfileId)
      .sort(byCreatedDesc)
      .map(copyModel);
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("voice_models")
    .select(MODEL_SELECT_FIELDS)
    .eq("learner_profile_id", learnerProfileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`VOICE_MODEL_LIST_FAILED:${error.message}`);
  return ((data ?? []) as VoiceModelRow[]).map(modelFromRow);
}

/** Published, tuned models only, in the public shape (no samples). */
export async function listPublishedVoiceModels(learnerProfileId: string): Promise<VoiceModelPublic[]> {
  const models = await listVoiceModelsForProfile(learnerProfileId);
  return models.filter(isVoiceModelPubliclyRunnable).map(toVoiceModelPublic);
}

export async function getVoiceModelStatus(learnerProfileId: string): Promise<ProofPieceStatus> {
  const models = await listVoiceModelsForProfile(learnerProfileId);
  if (models.length === 0) {
    return { state: "empty", summary: "Paste samples of your writing to tune a model on your voice." };
  }
  const live = models.filter(isVoiceModelPubliclyRunnable);
  if (live.length > 0) {
    const first = live[0]!;
    return {
      state: "live",
      summary:
        live.length === 1
          ? `${first.name} is live, tuned on ${first.sampleCount} ${first.sampleType || "samples"}.`
          : `${live.length} models are live on your page.`,
    };
  }
  const model = models[0]!;
  if (model.sampleCount < VOICE_MODEL_MIN_SAMPLES) {
    const needed = VOICE_MODEL_MIN_SAMPLES - model.sampleCount;
    return { state: "draft", summary: `Add ${needed} more ${needed === 1 ? "sample" : "samples"} to tune ${model.name}.` };
  }
  if (model.status !== "ready") {
    return { state: "draft", summary: `${model.name} has ${model.sampleCount} samples. Tune it to try it out.` };
  }
  return { state: "draft", summary: `${model.name} is tuned. Publish it to show it on your page.` };
}

export async function getVoiceModelById(id: string): Promise<VoiceModel | null> {
  if (mode() === "memory") {
    const model = memoryModels.get(id);
    return model ? copyModel(model) : null;
  }
  if (!isUuid(id)) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("voice_models")
    .select(MODEL_SELECT_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`VOICE_MODEL_READ_FAILED:${error.message}`);
  return data ? modelFromRow(data as VoiceModelRow) : null;
}

/** The model, only when it belongs to this learner. Callers answer 404 otherwise. */
export async function getVoiceModelForOwner(input: { id: string; learnerProfileId: string }): Promise<VoiceModel | null> {
  const model = await getVoiceModelById(input.id);
  if (!model || model.learnerProfileId !== input.learnerProfileId) return null;
  return model;
}

export async function findVoiceModelBySlug(input: { learnerProfileId: string; slug: string }): Promise<VoiceModel | null> {
  if (mode() === "memory") {
    const found = [...memoryModels.values()].find(
      (model) => model.learnerProfileId === input.learnerProfileId && model.slug === input.slug,
    );
    return found ? copyModel(found) : null;
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("voice_models")
    .select(MODEL_SELECT_FIELDS)
    .eq("learner_profile_id", input.learnerProfileId)
    .eq("slug", input.slug)
    .maybeSingle();
  if (error) throw new Error(`VOICE_MODEL_READ_FAILED:${error.message}`);
  return data ? modelFromRow(data as VoiceModelRow) : null;
}

export async function createVoiceModel(input: {
  learnerProfileId: string;
  name: string;
  purpose: string;
  sampleType: string;
}): Promise<VoiceModel> {
  const existing = await listVoiceModelsForProfile(input.learnerProfileId);
  const slug = uniqueVoiceModelSlug(
    slugifyVoiceModelName(input.name),
    existing.map((model) => model.slug),
  );
  const timestamp = nowIso();

  if (mode() === "memory") {
    const model: VoiceModel = {
      id: randomUUID(),
      learnerProfileId: input.learnerProfileId,
      slug,
      name: input.name,
      purpose: input.purpose,
      sampleType: input.sampleType,
      status: "draft",
      published: false,
      styleProfile: null,
      baseModel: null,
      sampleCount: 0,
      demoPrompt: null,
      demoBaseOutput: null,
      demoTunedOutput: null,
      tunedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memoryModels.set(model.id, model);
    return copyModel(model);
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("voice_models")
    .insert({
      learner_profile_id: input.learnerProfileId,
      slug,
      name: input.name,
      purpose: input.purpose,
      sample_type: input.sampleType,
      status: "draft",
      published: false,
      sample_count: 0,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select(MODEL_SELECT_FIELDS)
    .single();
  if (error) {
    // Two creates racing for the same slug: the unique index rejects one.
    if (error.code === "23505") throw new Error("VOICE_MODEL_SLUG_TAKEN");
    throw new Error(`VOICE_MODEL_CREATE_FAILED:${error.message}`);
  }
  return modelFromRow(data as VoiceModelRow);
}

export type VoiceModelDetailsPatch = {
  name?: string;
  purpose?: string;
  sampleType?: string;
};

export type VoiceModelDemoPatch = {
  demoPrompt: string;
  demoBaseOutput: string;
  demoTunedOutput: string;
};

type ModelPatch = Partial<
  Pick<
    VoiceModel,
    | "name"
    | "purpose"
    | "sampleType"
    | "status"
    | "published"
    | "styleProfile"
    | "baseModel"
    | "sampleCount"
    | "demoPrompt"
    | "demoBaseOutput"
    | "demoTunedOutput"
    | "tunedAt"
  >
>;

async function patchVoiceModel(id: string, patch: ModelPatch): Promise<VoiceModel> {
  const timestamp = nowIso();
  if (mode() === "memory") {
    const current = memoryModels.get(id);
    if (!current) throw new Error("VOICE_MODEL_NOT_FOUND");
    const next: VoiceModel = { ...current, ...patch, updatedAt: timestamp };
    memoryModels.set(id, next);
    return copyModel(next);
  }

  const row: Record<string, unknown> = { updated_at: timestamp };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.purpose !== undefined) row.purpose = patch.purpose;
  if (patch.sampleType !== undefined) row.sample_type = patch.sampleType;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.published !== undefined) row.published = patch.published;
  if (patch.styleProfile !== undefined) row.style_profile = patch.styleProfile;
  if (patch.baseModel !== undefined) row.base_model = patch.baseModel;
  if (patch.sampleCount !== undefined) row.sample_count = patch.sampleCount;
  if (patch.demoPrompt !== undefined) row.demo_prompt = patch.demoPrompt;
  if (patch.demoBaseOutput !== undefined) row.demo_base_output = patch.demoBaseOutput;
  if (patch.demoTunedOutput !== undefined) row.demo_tuned_output = patch.demoTunedOutput;
  if (patch.tunedAt !== undefined) row.tuned_at = patch.tunedAt;

  const { data, error } = await getSupabaseAdminClient()
    .from("voice_models")
    .update(row)
    .eq("id", id)
    .select(MODEL_SELECT_FIELDS)
    .maybeSingle();
  if (error) throw new Error(`VOICE_MODEL_UPDATE_FAILED:${error.message}`);
  if (!data) throw new Error("VOICE_MODEL_NOT_FOUND");
  return modelFromRow(data as VoiceModelRow);
}

/** Name, purpose and sample type. The slug never changes. */
export async function updateVoiceModelDetails(id: string, patch: VoiceModelDetailsPatch): Promise<VoiceModel> {
  return patchVoiceModel(id, patch);
}

/** Saves a comparison that really ran (the route verifies its signature first). */
export async function setVoiceModelDemo(id: string, demo: VoiceModelDemoPatch): Promise<VoiceModel> {
  return patchVoiceModel(id, demo);
}

export async function saveVoiceModelTuning(
  id: string,
  input: { styleProfile: VoiceStyleProfile; baseModel: string; demo: VoiceModelDemoPatch | null },
): Promise<VoiceModel> {
  const samples = await listVoiceModelSamples(id);
  // tunedAt is never older than the newest sample the tune read, so the
  // dashboard's "added since the last tune" count starts at zero.
  const newest = samples.reduce((latest, sample) => (sample.createdAt > latest ? sample.createdAt : latest), "");
  const now = nowIso();
  return patchVoiceModel(id, {
    status: "ready",
    styleProfile: input.styleProfile,
    baseModel: input.baseModel,
    sampleCount: samples.length,
    tunedAt: newest > now ? newest : now,
    ...(input.demo ?? {}),
  });
}

export async function setVoiceModelPublished(id: string, published: boolean): Promise<VoiceModel> {
  const model = await getVoiceModelById(id);
  if (!model) throw new Error("VOICE_MODEL_NOT_FOUND");
  if (published && (model.status !== "ready" || !model.styleProfile)) {
    throw new Error("VOICE_MODEL_NOT_TUNED");
  }
  return patchVoiceModel(id, { published });
}

/** Deletes the model, its samples and its run records. */
export async function deleteVoiceModel(id: string): Promise<void> {
  if (mode() === "memory") {
    memoryModels.delete(id);
    for (const [sampleId, sample] of memorySamples) {
      if (sample.voiceModelId === id) memorySamples.delete(sampleId);
    }
    for (let index = memoryRuns.length - 1; index >= 0; index -= 1) {
      if (memoryRuns[index]!.voiceModelId === id) memoryRuns.splice(index, 1);
    }
    return;
  }
  const supabase = getSupabaseAdminClient();
  // The foreign keys cascade; deleting samples first keeps this correct even
  // if the cascade were ever dropped.
  const samples = await supabase.from("voice_model_samples").delete().eq("voice_model_id", id);
  if (samples.error) throw new Error(`VOICE_MODEL_DELETE_FAILED:${samples.error.message}`);
  const { error } = await supabase.from("voice_models").delete().eq("id", id);
  if (error) throw new Error(`VOICE_MODEL_DELETE_FAILED:${error.message}`);
}

// --- samples ----------------------------------------------------------------

async function countSamples(voiceModelId: string): Promise<number> {
  if (mode() === "memory") {
    let count = 0;
    for (const sample of memorySamples.values()) if (sample.voiceModelId === voiceModelId) count += 1;
    return count;
  }
  const { count, error } = await getSupabaseAdminClient()
    .from("voice_model_samples")
    .select("id", { count: "exact", head: true })
    .eq("voice_model_id", voiceModelId);
  if (error) throw new Error(`VOICE_MODEL_SAMPLES_COUNT_FAILED:${error.message}`);
  return count ?? 0;
}

/** Oldest first: the order the learner added them. */
export async function listVoiceModelSamples(voiceModelId: string): Promise<VoiceModelSample[]> {
  if (mode() === "memory") {
    return [...memorySamples.values()]
      .filter((sample) => sample.voiceModelId === voiceModelId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map(copySample);
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("voice_model_samples")
    .select(SAMPLE_SELECT_FIELDS)
    .eq("voice_model_id", voiceModelId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`VOICE_MODEL_SAMPLES_LIST_FAILED:${error.message}`);
  return ((data ?? []) as VoiceModelSampleRow[]).map(sampleFromRow);
}

/** Recounts samples and applies the "below minimum goes back to draft" rule. */
async function syncSampleCount(voiceModelId: string): Promise<VoiceModel> {
  const sampleCount = await countSamples(voiceModelId);
  const model = await getVoiceModelById(voiceModelId);
  if (!model) throw new Error("VOICE_MODEL_NOT_FOUND");
  const patch: ModelPatch = { sampleCount };
  if (sampleCount < VOICE_MODEL_MIN_SAMPLES && model.status === "ready") {
    patch.status = "draft";
    patch.published = false;
  }
  return patchVoiceModel(voiceModelId, patch);
}

/**
 * Adds samples (already split and validated by `lib/voice-model/samples.ts`).
 * Refuses the whole batch when it would pass VOICE_MODEL_MAX_SAMPLES.
 */
export async function addVoiceModelSamples(input: {
  voiceModelId: string;
  learnerProfileId: string;
  samples: Array<{ title: string | null; content: string }>;
}): Promise<{ model: VoiceModel; samples: VoiceModelSample[] }> {
  const current = await countSamples(input.voiceModelId);
  if (current + input.samples.length > VOICE_MODEL_MAX_SAMPLES) {
    throw new Error("VOICE_MODEL_SAMPLE_LIMIT");
  }
  // Distinct, increasing timestamps keep the paste order stable on read.
  // The batch ends at "now" (not after it), so a tune right after adding
  // samples never sees them as newer than the tune.
  const base = Math.max(Date.now() - (input.samples.length - 1), lastSampleMs + 1);
  lastSampleMs = base + input.samples.length - 1;
  const rows = input.samples.map((sample, index) => ({
    id: randomUUID(),
    voiceModelId: input.voiceModelId,
    learnerProfileId: input.learnerProfileId,
    title: sample.title,
    content: sample.content,
    createdAt: new Date(base + index).toISOString(),
  }));

  let created: VoiceModelSample[];
  if (mode() === "memory") {
    for (const row of rows) memorySamples.set(row.id, row);
    created = rows.map(copySample);
  } else {
    const { data, error } = await getSupabaseAdminClient()
      .from("voice_model_samples")
      .insert(
        rows.map((row) => ({
          id: row.id,
          voice_model_id: row.voiceModelId,
          learner_profile_id: row.learnerProfileId,
          title: row.title,
          content: row.content,
          created_at: row.createdAt,
        })),
      )
      .select(SAMPLE_SELECT_FIELDS);
    if (error) throw new Error(`VOICE_MODEL_SAMPLES_CREATE_FAILED:${error.message}`);
    created = ((data ?? []) as VoiceModelSampleRow[]).map(sampleFromRow);
  }

  const model = await syncSampleCount(input.voiceModelId);
  return { model, samples: created };
}

/** Returns null when the sample does not belong to the model. */
export async function deleteVoiceModelSample(input: { voiceModelId: string; sampleId: string }): Promise<VoiceModel | null> {
  if (mode() === "memory") {
    const sample = memorySamples.get(input.sampleId);
    if (!sample || sample.voiceModelId !== input.voiceModelId) return null;
    memorySamples.delete(input.sampleId);
    return syncSampleCount(input.voiceModelId);
  }
  if (!isUuid(input.sampleId)) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("voice_model_samples")
    .delete()
    .eq("id", input.sampleId)
    .eq("voice_model_id", input.voiceModelId)
    .select("id");
  if (error) throw new Error(`VOICE_MODEL_SAMPLE_DELETE_FAILED:${error.message}`);
  if (!data || data.length === 0) return null;
  return syncSampleCount(input.voiceModelId);
}

// --- runs -------------------------------------------------------------------

export async function recordVoiceModelRun(input: {
  voiceModelId: string;
  source: VoiceModelRunSource;
  ipHash: string | null;
  prompt: string;
}): Promise<VoiceModelRun> {
  const run: VoiceModelRun = {
    id: randomUUID(),
    voiceModelId: input.voiceModelId,
    source: input.source,
    ipHash: input.ipHash,
    prompt: input.prompt,
    createdAt: nowIso(),
  };
  if (mode() === "memory") {
    memoryRuns.push(run);
    return { ...run };
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("voice_model_runs")
    .insert({
      id: run.id,
      voice_model_id: run.voiceModelId,
      source: run.source,
      ip_hash: run.ipHash,
      prompt: run.prompt,
      created_at: run.createdAt,
    })
    .select(RUN_SELECT_FIELDS)
    .single();
  if (error) throw new Error(`VOICE_MODEL_RUN_RECORD_FAILED:${error.message}`);
  return runFromRow(data as VoiceModelRunRow);
}

/**
 * Timestamps (oldest first) of runs since `sinceIso`, filtered by model and/or
 * ip hash and source, at most `limit` of them. The rate limiter needs the
 * count and the oldest timestamp in the window.
 */
export async function listRecentVoiceModelRunTimes(input: {
  sinceIso: string;
  limit: number;
  voiceModelId?: string;
  ipHash?: string;
  source?: VoiceModelRunSource;
}): Promise<string[]> {
  if (mode() === "memory") {
    return memoryRuns
      .filter(
        (run) =>
          run.createdAt >= input.sinceIso &&
          (input.voiceModelId === undefined || run.voiceModelId === input.voiceModelId) &&
          (input.ipHash === undefined || run.ipHash === input.ipHash) &&
          (input.source === undefined || run.source === input.source),
      )
      .map((run) => run.createdAt)
      .sort()
      .slice(0, input.limit);
  }
  let query = getSupabaseAdminClient()
    .from("voice_model_runs")
    .select("created_at")
    .gte("created_at", input.sinceIso);
  if (input.voiceModelId !== undefined) query = query.eq("voice_model_id", input.voiceModelId);
  if (input.ipHash !== undefined) query = query.eq("ip_hash", input.ipHash);
  if (input.source !== undefined) query = query.eq("source", input.source);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(input.limit);
  if (error) throw new Error(`VOICE_MODEL_RUNS_READ_FAILED:${error.message}`);
  return ((data ?? []) as Array<{ created_at: string }>).map((row) => row.created_at);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
