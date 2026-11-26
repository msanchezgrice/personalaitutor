import { z } from "zod";
import { VOICE_MODEL_PROMPT_MAX_CHARS, VOICE_MODEL_SAMPLE_MAX_CHARS, VOICE_MODEL_MAX_SAMPLES } from "@aitutor/shared";

/** Request bodies for the voice model routes. Pure, shared with the dashboard for limits. */

export const VOICE_MODEL_NAME_MAX = 40;
export const VOICE_MODEL_PURPOSE_MAX = 120;
export const VOICE_MODEL_SAMPLE_TYPE_MAX = 60;
export const VOICE_MODEL_PROMPT_MIN_CHARS = 3;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const createVoiceModelBodySchema = z.object({
  name: text(3, VOICE_MODEL_NAME_MAX),
  purpose: text(3, VOICE_MODEL_PURPOSE_MAX),
  sampleType: text(3, VOICE_MODEL_SAMPLE_TYPE_MAX),
});

export const voiceModelPromptSchema = text(VOICE_MODEL_PROMPT_MIN_CHARS, VOICE_MODEL_PROMPT_MAX_CHARS);

const runResultSchema = z.object({
  prompt: voiceModelPromptSchema,
  baseOutput: z.string().min(1).max(4000),
  tunedOutput: z.string().min(1).max(4000),
  signature: z.string().min(16).max(200),
});

export const patchVoiceModelBodySchema = z
  .object({
    name: text(3, VOICE_MODEL_NAME_MAX).optional(),
    purpose: text(3, VOICE_MODEL_PURPOSE_MAX).optional(),
    sampleType: text(3, VOICE_MODEL_SAMPLE_TYPE_MAX).optional(),
    /** A comparison returned by POST /api/voice-models/[id]/run, with its signature. */
    demo: runResultSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), { message: "EMPTY_PATCH" });

export const addSamplesBodySchema = z.object({
  // Room for the maximum number of samples at full length plus separators.
  text: z.string().min(1).max(VOICE_MODEL_SAMPLE_MAX_CHARS * VOICE_MODEL_MAX_SAMPLES + 400),
  title: z.string().trim().max(120).optional().nullable(),
});

export const runBodySchema = z.object({ prompt: voiceModelPromptSchema });

export const publishBodySchema = z.object({ published: z.boolean() });
