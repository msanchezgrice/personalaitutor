import "server-only";

import type { VoiceModel } from "@aitutor/shared";
import { billingAccessAllowed } from "@/lib/billing";
import { runtimeFindUserByHandle, runtimeGetBillingSubscription } from "@/lib/runtime";
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

// --- owner billing ------------------------------------------------------------
// Public runs spend the platform's model budget on the owner's behalf, so they
// stop when the owner's Career Builder access ends. billing_subscriptions is
// keyed by learner_profile_id, so the owner's status can be read without the
// owner's session (runtimeGetBillingAccessState does the same lookup for a
// signed-in user). Answers are cached per owner for 10 minutes in-process, so
// a lapsed plan stops public runs within 10 minutes per server instance.

export const VOICE_MODEL_OWNER_BILLING_TTL_MS = 10 * 60 * 1000;
const OWNER_BILLING_CACHE_MAX = 5_000;
const ownerBillingCache = new Map<string, { allowed: boolean; expiresAt: number }>();

export function resetVoiceModelOwnerBillingCacheForTests(): void {
  ownerBillingCache.clear();
}

export async function voiceModelOwnerHasBillingAccess(learnerProfileId: string, now: number = Date.now()): Promise<boolean> {
  const cached = ownerBillingCache.get(learnerProfileId);
  if (cached && cached.expiresAt > now) return cached.allowed;

  const subscription = await runtimeGetBillingSubscription(learnerProfileId);
  const allowed = billingAccessAllowed(subscription?.status);

  if (ownerBillingCache.size >= OWNER_BILLING_CACHE_MAX) {
    for (const [key, entry] of ownerBillingCache) {
      if (entry.expiresAt <= now) ownerBillingCache.delete(key);
    }
    if (ownerBillingCache.size >= OWNER_BILLING_CACHE_MAX) ownerBillingCache.clear();
  }
  ownerBillingCache.set(learnerProfileId, { allowed, expiresAt: now + VOICE_MODEL_OWNER_BILLING_TTL_MS });
  return allowed;
}
