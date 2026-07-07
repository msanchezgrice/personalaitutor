import "server-only";

import { randomUUID } from "node:crypto";
import {
  PROJECT_ARTIFACT_CONTENTS_TABLE,
  artifactContentRowFrom,
  type ArtifactContent,
  type ArtifactContentKind,
  type ArtifactContentRecord,
} from "@aitutor/shared";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Persistence for generated artifact content (Phase 2.1). Structured JSON is
 * stored per artifact URL so `/generated/[...slug]/route.ts` can feed the
 * existing HTML/PDF/DOCX/PPTX writers real content instead of placeholders.
 *
 * Follows the repo's memory/supabase dual-mode convention (see
 * `anonymous-assessment.ts`) so the vitest suite (PERSISTENCE_MODE=memory)
 * exercises the full pipeline in-process.
 *
 * Table: `project_artifact_contents`
 * (migration `supabase/migrations/20260707190000_add_project_artifact_contents.sql`).
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

// --- memory mode -----------------------------------------------------------

const memoryContents = new Map<string, ArtifactContentRecord>();

export function resetArtifactContentStateForTests() {
  memoryContents.clear();
}

// --- supabase row mapping ---------------------------------------------------

type ArtifactContentRow = {
  id: string;
  project_id: string;
  learner_profile_id: string | null;
  artifact_url: string;
  kind: string;
  content_kind: string;
  content: unknown;
  model: string | null;
  created_at: string;
};

const CONTENT_SELECT_FIELDS =
  "id,project_id,learner_profile_id,artifact_url,kind,content_kind,content,model,created_at";

function recordFromRow(row: ArtifactContentRow): ArtifactContentRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    learnerProfileId: row.learner_profile_id,
    artifactUrl: row.artifact_url,
    kind: row.kind,
    contentKind: row.content_kind as ArtifactContentKind,
    content: row.content as ArtifactContent,
    model: row.model,
    createdAt: row.created_at,
  };
}

// --- lifecycle ---------------------------------------------------------------

export async function persistArtifactContent(input: {
  projectId: string;
  learnerProfileId?: string | null;
  artifactUrl: string;
  kind: string;
  contentKind: ArtifactContentKind;
  content: ArtifactContent;
  model?: string | null;
}): Promise<ArtifactContentRecord> {
  const record: ArtifactContentRecord = {
    id: randomUUID(),
    projectId: input.projectId,
    learnerProfileId: input.learnerProfileId ?? null,
    artifactUrl: input.artifactUrl,
    kind: input.kind,
    contentKind: input.contentKind,
    content: input.content,
    model: input.model ?? null,
    createdAt: new Date().toISOString(),
  };

  if (mode() === "memory") {
    memoryContents.set(record.artifactUrl, record);
    return { ...record };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(PROJECT_ARTIFACT_CONTENTS_TABLE)
    .insert(artifactContentRowFrom(record))
    .select(CONTENT_SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(`ARTIFACT_CONTENT_PERSIST_FAILED:${error?.message ?? "NO_ROW"}`);
  }
  return recordFromRow(data as ArtifactContentRow);
}

export async function getArtifactContentByUrl(artifactUrl: string): Promise<ArtifactContentRecord | null> {
  const normalized = String(artifactUrl || "").trim();
  if (!normalized) return null;

  if (mode() === "memory") {
    const record = memoryContents.get(normalized);
    return record ? { ...record } : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from(PROJECT_ARTIFACT_CONTENTS_TABLE)
    .select(CONTENT_SELECT_FIELDS)
    .eq("artifact_url", normalized)
    .maybeSingle();
  return data ? recordFromRow(data as ArtifactContentRow) : null;
}
