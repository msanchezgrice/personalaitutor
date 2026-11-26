import "server-only";

import type { VoiceModel } from "@aitutor/shared";
import { runtimeFindUserByHandle } from "@/lib/runtime";
import { isValidVoiceModelSlug } from "@/lib/voice-model/slug";
import { findVoiceModelBySlug, isVoiceModelPubliclyRunnable } from "@/lib/voice-model/store";

/**
 * The model a visitor may run: the learner's profile is published and the
 * model is published and tuned. Anything else is "not found" to the public.
 */
export async function findPublicVoiceModel(input: { handle: string; slug: string }): Promise<VoiceModel | null> {
  const handle = input.handle.trim().toLowerCase();
  if (!handle || handle.length > 80 || !/^[a-z0-9-]+$/.test(handle)) return null;
  if (!isValidVoiceModelSlug(input.slug)) return null;
  const profile = await runtimeFindUserByHandle(handle);
  if (!profile || !profile.published) return null;
  const model = await findVoiceModelBySlug({ learnerProfileId: profile.id, slug: input.slug });
  if (!model || !isVoiceModelPubliclyRunnable(model)) return null;
  return model;
}
