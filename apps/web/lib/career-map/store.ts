import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import type { CareerMap, CareerMapRecord, CareerMapSource, CareerMapStatus } from "@aitutor/shared";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Persistence for career maps (table `public.career_maps`, migration
 * `supabase/migrations/20261126030000_add_career_map_and_proof_studio.sql`).
 *
 * Dual mode like `lib/anonymous-assessment.ts`: `memory` for tests and local
 * runs (PERSISTENCE_MODE=memory), `supabase` (service role) in production.
 * Maps are keyed by an unguessable token; the row never leaves the server
 * as-is. Public surfaces go through `toCareerMapView`.
 */

const TABLE = "career_maps";

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

export function generateCareerMapToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Lower-cased, trimmed email, or null when it is not a plausible address. */
export function normalizeCareerMapEmail(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized || normalized.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return null;
  return normalized;
}

function cleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

const SOURCES: readonly CareerMapSource[] = ["paste", "upload", "describe"];
const STATUSES: readonly CareerMapStatus[] = ["generating", "completed", "failed"];

// --- memory mode -----------------------------------------------------------

const memoryMaps = new Map<string, CareerMapRecord>();

export function resetCareerMapStateForTests(): void {
  memoryMaps.clear();
}

function copy(record: CareerMapRecord): CareerMapRecord {
  return { ...record };
}

function findMemoryByToken(token: string): CareerMapRecord | null {
  for (const record of memoryMaps.values()) {
    if (record.token === token) return record;
  }
  return null;
}

// --- supabase row mapping ---------------------------------------------------

type CareerMapRow = {
  id: string;
  token: string;
  status: string;
  source: string;
  input_text: string;
  map: unknown;
  model: string | null;
  failure_reason: string | null;
  email: string | null;
  email_captured_at: string | null;
  map_email_sent_at: string | null;
  learner_profile_id: string | null;
  linked_at: string | null;
  visitor_id: string | null;
  ip_hash: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_FIELDS =
  "id,token,status,source,input_text,map,model,failure_reason,email,email_captured_at,map_email_sent_at,learner_profile_id,linked_at,visitor_id,ip_hash,created_at,updated_at";

function fromRow(row: CareerMapRow): CareerMapRecord {
  const status = STATUSES.includes(row.status as CareerMapStatus) ? (row.status as CareerMapStatus) : "failed";
  const source = SOURCES.includes(row.source as CareerMapSource) ? (row.source as CareerMapSource) : "paste";
  const map = row.map && typeof row.map === "object" ? (row.map as CareerMap) : null;
  return {
    id: row.id,
    token: row.token,
    status,
    source,
    inputText: row.input_text ?? "",
    map,
    model: row.model,
    failureReason: row.failure_reason,
    email: row.email,
    emailCapturedAt: row.email_captured_at,
    mapEmailSentAt: row.map_email_sent_at,
    learnerProfileId: row.learner_profile_id,
    linkedAt: row.linked_at,
    visitorId: row.visitor_id,
    ipHash: row.ip_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- lifecycle --------------------------------------------------------------

export async function createCareerMapRecord(input: {
  source: CareerMapSource;
  inputText: string;
  visitorId?: string | null;
  ipHash?: string | null;
  learnerProfileId?: string | null;
}): Promise<CareerMapRecord> {
  const now = new Date().toISOString();
  const learnerProfileId = cleanText(input.learnerProfileId, 80);
  const record: CareerMapRecord = {
    id: randomUUID(),
    token: generateCareerMapToken(),
    status: "generating",
    source: SOURCES.includes(input.source) ? input.source : "paste",
    inputText: input.inputText,
    map: null,
    model: null,
    failureReason: null,
    email: null,
    emailCapturedAt: null,
    mapEmailSentAt: null,
    learnerProfileId,
    linkedAt: learnerProfileId ? now : null,
    visitorId: cleanText(input.visitorId, 160),
    ipHash: cleanText(input.ipHash, 128),
    createdAt: now,
    updatedAt: now,
  };

  if (mode() === "memory") {
    memoryMaps.set(record.id, record);
    return copy(record);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id: record.id,
      token: record.token,
      status: record.status,
      source: record.source,
      input_text: record.inputText,
      learner_profile_id: record.learnerProfileId,
      linked_at: record.linkedAt,
      visitor_id: record.visitorId,
      ip_hash: record.ipHash,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    })
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(`CAREER_MAP_CREATE_FAILED:${error?.message ?? "NO_ROW"}`);
  }
  return fromRow(data as CareerMapRow);
}

export async function completeCareerMapRecord(input: { id: string; map: CareerMap; model: string }): Promise<CareerMapRecord> {
  const now = new Date().toISOString();

  if (mode() === "memory") {
    const record = memoryMaps.get(input.id);
    if (!record) throw new Error("CAREER_MAP_COMPLETE_FAILED:NOT_FOUND");
    const next: CareerMapRecord = {
      ...record,
      status: "completed",
      map: input.map,
      model: input.model,
      failureReason: null,
      updatedAt: now,
    };
    memoryMaps.set(record.id, next);
    return copy(next);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: "completed",
      map: input.map,
      model: input.model,
      failure_reason: null,
      previous_title: input.map.person.previousTitle,
      primary_title_id: input.map.primary.titleId,
      updated_at: now,
    })
    .eq("id", input.id)
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(`CAREER_MAP_COMPLETE_FAILED:${error?.message ?? "NOT_FOUND"}`);
  }
  return fromRow(data as CareerMapRow);
}

export async function failCareerMapRecord(input: { id: string; reason: string }): Promise<void> {
  const now = new Date().toISOString();
  const reason = (input.reason || "UNKNOWN").slice(0, 300);

  if (mode() === "memory") {
    const record = memoryMaps.get(input.id);
    if (!record) return;
    memoryMaps.set(record.id, { ...record, status: "failed", failureReason: reason, updatedAt: now });
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ status: "failed", failure_reason: reason, updated_at: now })
    .eq("id", input.id);
  if (error) {
    throw new Error(`CAREER_MAP_FAIL_UPDATE_FAILED:${error.message}`);
  }
}

export async function findCareerMapByToken(token: string): Promise<CareerMapRecord | null> {
  const normalized = cleanText(token, 200);
  if (!normalized) return null;

  if (mode() === "memory") {
    const match = findMemoryByToken(normalized);
    return match ? copy(match) : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from(TABLE).select(SELECT_FIELDS).eq("token", normalized).maybeSingle();
  if (error) {
    throw new Error(`CAREER_MAP_READ_FAILED:${error.message}`);
  }
  return data ? fromRow(data as CareerMapRow) : null;
}

/** Thrown when a map already has a different email, or already belongs to an account. */
export const CAREER_MAP_EMAIL_LOCKED = "CAREER_MAP_EMAIL_LOCKED";

/**
 * Saves the email on the map. Returns null when the token is unknown.
 *
 * An email is set once: a map that already has a different address, or that
 * is already linked to an account, is not changed (`CAREER_MAP_EMAIL_LOCKED`).
 * The write is conditional in the database, so two concurrent requests cannot
 * both set an address.
 */
export async function captureCareerMapEmail(input: { token: string; email: string }): Promise<CareerMapRecord | null> {
  const email = normalizeCareerMapEmail(input.email);
  if (!email) return null;
  const existing = await findCareerMapByToken(input.token);
  if (!existing) return null;
  if (existing.email === email) return existing;
  if (existing.email || existing.learnerProfileId) throw new Error(CAREER_MAP_EMAIL_LOCKED);

  const now = new Date().toISOString();

  if (mode() === "memory") {
    const record = memoryMaps.get(existing.id);
    if (!record) return null;
    if (record.email || record.learnerProfileId) throw new Error(CAREER_MAP_EMAIL_LOCKED);
    const next: CareerMapRecord = {
      ...record,
      email,
      emailCapturedAt: record.emailCapturedAt ?? now,
      updatedAt: now,
    };
    memoryMaps.set(record.id, next);
    return copy(next);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ email, email_captured_at: existing.emailCapturedAt ?? now, updated_at: now })
    .eq("id", existing.id)
    .is("email", null)
    .is("learner_profile_id", null)
    .select(SELECT_FIELDS)
    .maybeSingle();
  if (error) {
    throw new Error(`CAREER_MAP_EMAIL_CAPTURE_FAILED:${error.message}`);
  }
  // No row: another request set an address (or linked the map) first.
  if (!data) throw new Error(CAREER_MAP_EMAIL_LOCKED);
  return fromRow(data as CareerMapRow);
}

/** Removes a record that was created and then refused (over a rate limit). */
export async function deleteCareerMapRecord(id: string): Promise<void> {
  if (mode() === "memory") {
    memoryMaps.delete(id);
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) {
    throw new Error(`CAREER_MAP_DELETE_FAILED:${error.message}`);
  }
}

export async function markCareerMapEmailSent(id: string): Promise<void> {
  const now = new Date().toISOString();

  if (mode() === "memory") {
    const record = memoryMaps.get(id);
    if (!record) return;
    memoryMaps.set(id, { ...record, mapEmailSentAt: now, updatedAt: now });
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).update({ map_email_sent_at: now, updated_at: now }).eq("id", id);
  if (error) {
    throw new Error(`CAREER_MAP_EMAIL_MARK_FAILED:${error.message}`);
  }
}

/**
 * Links one map to a learner profile. Idempotent: a map already linked to this
 * profile is returned as-is. Never steals a map linked to someone else: that
 * case returns null, as does an unknown token.
 */
export async function linkCareerMapByToken(input: { token: string; learnerProfileId: string }): Promise<CareerMapRecord | null> {
  const learnerProfileId = cleanText(input.learnerProfileId, 80);
  if (!learnerProfileId) return null;
  const existing = await findCareerMapByToken(input.token);
  if (!existing) return null;
  if (existing.learnerProfileId) {
    return existing.learnerProfileId === learnerProfileId ? existing : null;
  }

  const now = new Date().toISOString();

  if (mode() === "memory") {
    const record = memoryMaps.get(existing.id);
    if (!record) return null;
    if (record.learnerProfileId) {
      return record.learnerProfileId === learnerProfileId ? copy(record) : null;
    }
    const next: CareerMapRecord = { ...record, learnerProfileId, linkedAt: now, updatedAt: now };
    memoryMaps.set(record.id, next);
    return copy(next);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ learner_profile_id: learnerProfileId, linked_at: now, updated_at: now })
    .eq("id", existing.id)
    .is("learner_profile_id", null)
    .select(SELECT_FIELDS)
    .maybeSingle();
  if (error) {
    throw new Error(`CAREER_MAP_LINK_FAILED:${error.message}`);
  }
  if (data) return fromRow(data as CareerMapRow);

  // Lost a race: someone linked it between the read and the update.
  const reread = await findCareerMapByToken(input.token);
  return reread && reread.learnerProfileId === learnerProfileId ? reread : null;
}

/** Links every unlinked map captured with this email. Returns how many were linked. */
export async function linkCareerMapsByEmail(input: { email: string; learnerProfileId: string }): Promise<number> {
  const learnerProfileId = cleanText(input.learnerProfileId, 80);
  const email = normalizeCareerMapEmail(input.email);
  if (!learnerProfileId || !email) return 0;

  const now = new Date().toISOString();

  if (mode() === "memory") {
    let linked = 0;
    for (const [id, record] of memoryMaps) {
      if (record.email !== email || record.learnerProfileId) continue;
      memoryMaps.set(id, { ...record, learnerProfileId, linkedAt: now, updatedAt: now });
      linked += 1;
    }
    return linked;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ learner_profile_id: learnerProfileId, linked_at: now, updated_at: now })
    .eq("email", email)
    .is("learner_profile_id", null)
    .select("id");
  if (error) {
    throw new Error(`CAREER_MAP_LINK_FAILED:${error.message}`);
  }
  return data?.length ?? 0;
}

/** Latest completed map linked to the profile, or null. */
export async function getLatestCareerMapForProfile(learnerProfileId: string): Promise<CareerMapRecord | null> {
  const normalized = cleanText(learnerProfileId, 80);
  if (!normalized) return null;

  if (mode() === "memory") {
    const matches = Array.from(memoryMaps.values())
      .filter((entry) => entry.learnerProfileId === normalized && entry.status === "completed" && entry.map)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = matches[matches.length - 1];
    return latest ? copy(latest) : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq("learner_profile_id", normalized)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`CAREER_MAP_READ_FAILED:${error.message}`);
  }
  return data ? fromRow(data as CareerMapRow) : null;
}

function inWindow(record: CareerMapRecord, ipHash: string | null, sinceIso: string) {
  if (record.createdAt < sinceIso) return false;
  return ipHash ? record.ipHash === ipHash : true;
}

/** Count of maps created since `sinceIso`, for one ip hash or (when ipHash is omitted) for everyone. */
export async function countRecentCareerMaps(input: { ipHash?: string | null; sinceIso: string }): Promise<number> {
  const ipHash = cleanText(input.ipHash, 128);

  if (mode() === "memory") {
    let count = 0;
    for (const record of memoryMaps.values()) {
      if (inWindow(record, ipHash, input.sinceIso)) count += 1;
    }
    return count;
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase.from(TABLE).select("id", { count: "exact", head: true }).gte("created_at", input.sinceIso);
  if (ipHash) query = query.eq("ip_hash", ipHash);
  const { count, error } = await query;
  if (error) {
    throw new Error(`CAREER_MAP_COUNT_FAILED:${error.message}`);
  }
  return count ?? 0;
}

/**
 * `createdAt` of the oldest map in the window (same filter as
 * `countRecentCareerMaps`), or null when the window is empty. Used to tell a
 * rate-limited visitor when the window frees up.
 */
export async function findOldestRecentCareerMapAt(input: { ipHash?: string | null; sinceIso: string }): Promise<string | null> {
  const ipHash = cleanText(input.ipHash, 128);

  if (mode() === "memory") {
    let oldest: string | null = null;
    for (const record of memoryMaps.values()) {
      if (!inWindow(record, ipHash, input.sinceIso)) continue;
      if (!oldest || record.createdAt < oldest) oldest = record.createdAt;
    }
    return oldest;
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase.from(TABLE).select("created_at").gte("created_at", input.sinceIso);
  if (ipHash) query = query.eq("ip_hash", ipHash);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`CAREER_MAP_COUNT_FAILED:${error.message}`);
  }
  return (data as { created_at?: string } | null)?.created_at ?? null;
}

/** Test helper: shifts a stored map's createdAt (memory mode only). */
export function setCareerMapCreatedAtForTests(id: string, createdAt: string): void {
  const record = memoryMaps.get(id);
  if (record) memoryMaps.set(id, { ...record, createdAt });
}
