import "server-only";
import { appendJobEvent, listUserEvents, type ProofSite } from "@aitutor/shared";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Draft vs live for the proof site, without a schema change.
 *
 * proof_sites has no status or published-at column, and learner_profiles only
 * has a boolean `published`. A learner whose profile was published before
 * they ever opened the proof site editor would otherwise see their first
 * "save" replace their public page. So the public sees the proof site only
 * when the profile is published AND an explicit publish action was recorded
 * at or after the proof site row was created (proof_sites.created_at, set on
 * the first save and never changed afterwards).
 *
 * Publish actions already live in agent_jobs (indexed on status, created_at):
 *  - `proof_site.publish`: written by POST /api/proof/site/publish, the
 *    editor's Publish button (this module).
 *  - `profile.publish`: written by runtimePublishProfile (POST
 *    /api/profile/publish). Counted so learners who published from the editor
 *    before this check existed (it used that route) stay live.
 * Memory mode keeps the same facts as job events (`proof_site.published`,
 * `profile.published`).
 *
 * After the first explicit publish, later saves go live at once, which is
 * what the editor says ("Saved. Your public page is updated."). The column
 * this stands in for: `proof_sites.published_at timestamptz` (null = never
 * published from the editor).
 */

const LIVE_JOB_TYPES = ["proof_site.publish", "profile.publish"] as const;
const LIVE_EVENT_TYPES = ["proof_site.published", "profile.published"] as const;

function mode(): "memory" | "supabase" {
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

/** Records that the learner published from the proof site editor. Throws when it could not be stored. */
export async function recordProofSitePublished(input: { learnerProfileId: string; handle: string }): Promise<void> {
  if (mode() === "memory") {
    appendJobEvent({
      jobId: "proof-site",
      userId: input.learnerProfileId,
      projectId: null,
      type: "proof_site.published",
      message: `Proof site /u/${input.handle} published`,
      payload: { handle: input.handle },
    });
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agent_jobs")
    .insert({
      learner_profile_id: input.learnerProfileId,
      project_id: null,
      type: "proof_site.publish",
      payload: { handle: input.handle },
      status: "completed",
      attempts: 0,
      max_attempts: 3,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`PROOF_SITE_PUBLISH_RECORD_FAILED:${error?.message ?? "NO_ROW"}`);

  // The job row is the marker; the event is only the usual audit trail.
  const event = await supabase.from("agent_job_events").insert({
    job_id: (data as { id: string }).id,
    learner_profile_id: input.learnerProfileId,
    project_id: null,
    event_type: "proof_site.published",
    message: `Proof site /u/${input.handle} published`,
    payload: { handle: input.handle },
  });
  if (event.error) console.error("[proof-site] publish event insert failed", event.error.message);
}

/** True when visitors should see the proof site rather than the earlier profile page. Fails closed. */
export async function isProofSiteLive(input: { site: Pick<ProofSite, "learnerProfileId" | "createdAt">; profilePublished: boolean }): Promise<boolean> {
  if (!input.profilePublished) return false;
  const since = input.site.createdAt;

  if (mode() === "memory") {
    return listUserEvents(input.site.learnerProfileId).some(
      (event) => (LIVE_EVENT_TYPES as readonly string[]).includes(event.type) && event.createdAt >= since,
    );
  }

  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("agent_jobs")
      .select("id")
      .eq("status", "completed")
      .gte("created_at", since)
      .eq("learner_profile_id", input.site.learnerProfileId)
      .in("type", [...LIVE_JOB_TYPES])
      .limit(1);
    if (error) throw new Error(error.message);
    return Boolean(data && data.length > 0);
  } catch (error) {
    console.error("[proof-site] live check failed", error instanceof Error ? error.message : error);
    return false;
  }
}
