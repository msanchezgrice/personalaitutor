// FOUNDATION-SEED (owner: workstream E, voice model). Signatures other
// workstreams rely on; workstream E replaces the bodies, adds whatever else it
// needs and removes this marker. Tables: public.voice_models,
// voice_model_samples, voice_model_runs.
import "server-only";
import type { ProofPieceStatus, VoiceModel, VoiceModelPublic } from "@aitutor/shared";

const seed = (name: string): never => {
  throw new Error(`FOUNDATION_SEED_NOT_IMPLEMENTED:voice-model/store.${name}`);
};

export async function listVoiceModelsForProfile(_learnerProfileId: string): Promise<VoiceModel[]> {
  return seed("listVoiceModelsForProfile");
}

/** Published, tuned models only, in the public shape (no samples). */
export async function listPublishedVoiceModels(_learnerProfileId: string): Promise<VoiceModelPublic[]> {
  return seed("listPublishedVoiceModels");
}

export async function getVoiceModelStatus(_learnerProfileId: string): Promise<ProofPieceStatus> {
  return seed("getVoiceModelStatus");
}

export function resetVoiceModelStateForTests(): void {
  seed("resetVoiceModelStateForTests");
}
