import "server-only";

import { getLatestCareerMapForProfile } from "@/lib/career-map/store";
import { VOICE_MODEL_NAME_MAX, VOICE_MODEL_SAMPLE_TYPE_MAX } from "@/lib/voice-model/schemas";

export type VoiceModelPrefill = { name: string; sampleType: string; summary: string };

/**
 * Suggested name and sample type from the learner's career map proof plan
 * (`proofPlan.model`). Best effort: no map, or a map store error, means no
 * suggestion, never a failed page.
 */
export async function loadVoiceModelPrefill(learnerProfileId: string): Promise<VoiceModelPrefill | null> {
  try {
    const record = await getLatestCareerMapForProfile(learnerProfileId);
    const plan = record?.map?.proofPlan.model;
    if (!plan) return null;
    return {
      name: plan.name.slice(0, VOICE_MODEL_NAME_MAX),
      sampleType: plan.sampleType.slice(0, VOICE_MODEL_SAMPLE_TYPE_MAX),
      summary: plan.summary,
    };
  } catch {
    return null;
  }
}
