import "server-only";
import type { ProofPieceStatus, ProofSite } from "@aitutor/shared";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Proof site settings (table public.proof_sites): the copy for the new public
 * page at /u/{handle}. One row per learner profile. Name, handle and the
 * published flag stay on learner_profiles; this table only holds what the
 * page adds on top (new title, previous role, tagline, bio, translations,
 * contact details).
 *
 * Dual mode like the other stores: memory for tests and local dev, Supabase
 * (service role) in production.
 */

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

const PROOF_SITES_TABLE = "proof_sites";
const PROOF_SITE_SELECT_FIELDS =
  "learner_profile_id,career_map_id,new_title,previous_role,tagline,bio,translations,contact_email,linkedin_url,created_at,updated_at";

type ProofSiteRow = {
  learner_profile_id: string;
  career_map_id: string | null;
  new_title: string;
  previous_role: string | null;
  tagline: string | null;
  bio: string | null;
  translations: unknown;
  contact_email: string | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeTranslations(value: unknown): ProofSite["translations"] {
  if (!Array.isArray(value)) return [];
  const rows: ProofSite["translations"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const before = (entry as { before?: unknown }).before;
    const now = (entry as { now?: unknown }).now;
    if (typeof before === "string" && typeof now === "string" && before.trim() && now.trim()) {
      rows.push({ before: before.trim(), now: now.trim() });
    }
  }
  return rows;
}

function fromRow(row: ProofSiteRow): ProofSite {
  return {
    learnerProfileId: row.learner_profile_id,
    careerMapId: row.career_map_id ?? null,
    newTitle: row.new_title,
    previousRole: row.previous_role ?? null,
    tagline: row.tagline ?? "",
    bio: row.bio ?? "",
    translations: normalizeTranslations(row.translations),
    contactEmail: row.contact_email ?? null,
    linkedinUrl: row.linkedin_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function copySite(site: ProofSite): ProofSite {
  return { ...site, translations: site.translations.map((row) => ({ ...row })) };
}

const memorySites = new Map<string, ProofSite>();

export function resetProofSiteStateForTests(): void {
  memorySites.clear();
}

export async function getProofSite(learnerProfileId: string): Promise<ProofSite | null> {
  if (!learnerProfileId) return null;
  if (mode() === "memory") {
    const found = memorySites.get(learnerProfileId);
    return found ? copySite(found) : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(PROOF_SITES_TABLE)
    .select(PROOF_SITE_SELECT_FIELDS)
    .eq("learner_profile_id", learnerProfileId)
    .maybeSingle();
  if (error) {
    throw new Error(`PROOF_SITE_READ_FAILED:${error.message}`);
  }
  return data ? fromRow(data as ProofSiteRow) : null;
}

export async function upsertProofSite(input: Omit<ProofSite, "createdAt" | "updatedAt">): Promise<ProofSite> {
  if (!input.learnerProfileId) {
    throw new Error("PROOF_SITE_UPSERT_FAILED:LEARNER_PROFILE_REQUIRED");
  }
  const nowIso = new Date().toISOString();
  const translations = normalizeTranslations(input.translations);

  if (mode() === "memory") {
    const existing = memorySites.get(input.learnerProfileId);
    const saved: ProofSite = {
      learnerProfileId: input.learnerProfileId,
      careerMapId: input.careerMapId ?? null,
      newTitle: input.newTitle,
      previousRole: input.previousRole ?? null,
      tagline: input.tagline,
      bio: input.bio,
      translations,
      contactEmail: input.contactEmail ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
    memorySites.set(input.learnerProfileId, saved);
    return copySite(saved);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(PROOF_SITES_TABLE)
    .upsert(
      {
        learner_profile_id: input.learnerProfileId,
        career_map_id: input.careerMapId ?? null,
        new_title: input.newTitle,
        previous_role: input.previousRole ?? null,
        tagline: input.tagline,
        bio: input.bio,
        translations,
        contact_email: input.contactEmail ?? null,
        linkedin_url: input.linkedinUrl ?? null,
        updated_at: nowIso,
      },
      { onConflict: "learner_profile_id" },
    )
    .select(PROOF_SITE_SELECT_FIELDS)
    .single();
  if (error || !data) {
    throw new Error(`PROOF_SITE_UPSERT_FAILED:${error?.message ?? "NO_ROW"}`);
  }
  return fromRow(data as ProofSiteRow);
}

/** `published` is learner_profiles.published for this learner. */
export async function getProofSiteStatus(input: { learnerProfileId: string; published: boolean }): Promise<ProofPieceStatus> {
  const site = await getProofSite(input.learnerProfileId);
  if (!site) {
    return { state: "empty", summary: "Draft your site from your career map." };
  }
  if (!input.published) {
    return { state: "draft", summary: "Saved. Publish it when you are ready." };
  }
  return { state: "live", summary: "Live. Anyone with the link can see it." };
}
