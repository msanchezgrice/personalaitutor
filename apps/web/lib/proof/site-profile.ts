import "server-only";
import { upsertUserProfile } from "@aitutor/shared";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { runtimeFindUserByHandle, runtimeFindUserById } from "@/lib/runtime";
import { isReservedProfileHandle } from "@/lib/reserved-handles";

/**
 * Learner-profile helpers for the proof site: handle rules and unpublishing.
 * Kept out of lib/runtime.ts on purpose (that file must not grow).
 */

export const PROOF_SITE_HANDLE_MIN = 3;
export const PROOF_SITE_HANDLE_MAX = 40;

/** Handles that serve built-in example pages and can never be claimed (one list, in lib/reserved-handles.ts). */
export { RESERVED_PROFILE_HANDLES } from "@/lib/reserved-handles";

export type HandleCheck =
  | { ok: true; handle: string }
  | { ok: false; code: "HANDLE_INVALID" | "HANDLE_TAKEN"; message: string };

/** Lower case, letters, digits and single dashes, 3 to 40 characters, no leading or trailing dash. */
export function normalizeProfileHandle(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateProfileHandleFormat(input: string): HandleCheck {
  const handle = normalizeProfileHandle(input);
  if (handle.length < PROOF_SITE_HANDLE_MIN || handle.length > PROOF_SITE_HANDLE_MAX) {
    return {
      ok: false,
      code: "HANDLE_INVALID",
      message: `Use ${PROOF_SITE_HANDLE_MIN} to ${PROOF_SITE_HANDLE_MAX} letters, numbers or dashes.`,
    };
  }
  if (handle !== input.trim().toLowerCase()) {
    return {
      ok: false,
      code: "HANDLE_INVALID",
      message: `Use only lower-case letters, numbers and single dashes, for example "${handle}".`,
    };
  }
  return { ok: true, handle };
}

/** Checks format, the reserved list and whether another learner already holds the handle. */
export async function checkProfileHandleAvailable(input: { handle: string; learnerProfileId: string }): Promise<HandleCheck> {
  const format = validateProfileHandleFormat(input.handle);
  if (!format.ok) return format;
  if (isReservedProfileHandle(format.handle)) {
    return { ok: false, code: "HANDLE_TAKEN", message: `The address /u/${format.handle} is taken. Try another one.` };
  }
  const holder = await runtimeFindUserByHandle(format.handle);
  if (holder && holder.id !== input.learnerProfileId) {
    return { ok: false, code: "HANDLE_TAKEN", message: `The address /u/${format.handle} is taken. Try another one.` };
  }
  return format;
}

function persistenceMode(): "memory" | "supabase" {
  const explicit = process.env.PERSISTENCE_MODE?.toLowerCase();
  if (explicit === "supabase" || explicit === "memory") return explicit;
  if (explicit) throw new Error("PERSISTENCE_MODE_INVALID");
  const hasSupabaseCreds = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
  );
  if (hasSupabaseCreds) return "supabase";
  throw new Error("PERSISTENCE_MODE_REQUIRED");
}

/** Sets learner_profiles.published = false. Returns the updated profile, or null for an unknown learner. */
export async function unpublishLearnerProfile(learnerProfileId: string) {
  const profile = await runtimeFindUserById(learnerProfileId);
  if (!profile) return null;

  if (persistenceMode() === "memory") {
    upsertUserProfile({ id: profile.id, published: false });
    return runtimeFindUserById(profile.id);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("learner_profiles")
    .update({ published: false, updated_at: new Date().toISOString() })
    .eq("id", profile.id);
  if (error) {
    throw new Error(`PROFILE_UNPUBLISH_FAILED:${error.message}`);
  }
  return runtimeFindUserById(profile.id);
}
