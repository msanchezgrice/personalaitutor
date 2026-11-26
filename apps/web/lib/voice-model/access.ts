import "server-only";

import type { NextRequest } from "next/server";
import { jsonError } from "@aitutor/shared";
import type { VoiceModel } from "@aitutor/shared";
import { getUserId } from "@/lib/api";
import { getAuthSeed } from "@/lib/auth";
import { billingSeedFromAuthSeed, requireBillingAccess } from "@/lib/billing-access";
import { getVoiceModelForOwner } from "@/lib/voice-model/store";

/**
 * Access checks for the owner routes under /api/voice-models. Every route is
 * billing-gated (Career Builder plan), and every [id] route answers 404 for a
 * model that belongs to someone else, so ids cannot be probed.
 */

export type VoiceModelOwner = { learnerProfileId: string; handle: string; profilePublished: boolean };

export async function resolveVoiceModelOwner(
  req: NextRequest,
): Promise<{ ok: true; owner: VoiceModelOwner } | { ok: false; response: Response }> {
  const seed = await getAuthSeed(req);
  const userId = seed?.userId ?? getUserId(req);
  if (!userId) {
    return { ok: false, response: jsonError("UNAUTHENTICATED", "Sign in required", 401) };
  }
  const access = await requireBillingAccess({
    userId,
    seed: billingSeedFromAuthSeed(seed),
    message: "Start your 7-day free trial to tune a model on your writing.",
  });
  if (!access.ok) return { ok: false, response: access.response };
  const profile = access.billing.profile;
  if (!profile) {
    return { ok: false, response: jsonError("USER_NOT_FOUND", "No learner profile", 404) };
  }
  return {
    ok: true,
    owner: { learnerProfileId: profile.id, handle: profile.handle, profilePublished: Boolean(profile.published) },
  };
}

export function voiceModelNotFound() {
  return jsonError("VOICE_MODEL_NOT_FOUND", "That model was not found.", 404);
}

/** Owner + the model behind `id`, or the error response to return. */
export async function resolveOwnedVoiceModel(
  req: NextRequest,
  id: string,
): Promise<{ ok: true; owner: VoiceModelOwner; model: VoiceModel } | { ok: false; response: Response }> {
  const resolved = await resolveVoiceModelOwner(req);
  if (!resolved.ok) return resolved;
  const model = await getVoiceModelForOwner({ id, learnerProfileId: resolved.owner.learnerProfileId });
  if (!model) return { ok: false, response: voiceModelNotFound() };
  return { ok: true, owner: resolved.owner, model };
}

/** Where the model shows publicly (the learner's page). */
export function voiceModelPublicPath(handle: string, slug: string): string {
  return `/u/${encodeURIComponent(handle)}#model-${slug}`;
}

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
