// FOUNDATION-SEED (owner: workstream A, career map engine). This file fixes the
// exported signatures other workstreams compile against. Workstream A replaces
// every body with the real dual-mode (memory | supabase) implementation and
// removes this marker. Table: public.career_maps.
import "server-only";
import type { CareerMap, CareerMapRecord, CareerMapSource } from "@aitutor/shared";

const seed = (name: string): never => {
  throw new Error(`FOUNDATION_SEED_NOT_IMPLEMENTED:career-map/store.${name}`);
};

export function generateCareerMapToken(): string {
  return seed("generateCareerMapToken");
}

export async function createCareerMapRecord(_input: {
  source: CareerMapSource;
  inputText: string;
  visitorId?: string | null;
  ipHash?: string | null;
  learnerProfileId?: string | null;
}): Promise<CareerMapRecord> {
  return seed("createCareerMapRecord");
}

export async function completeCareerMapRecord(_input: { id: string; map: CareerMap; model: string }): Promise<CareerMapRecord> {
  return seed("completeCareerMapRecord");
}

export async function failCareerMapRecord(_input: { id: string; reason: string }): Promise<void> {
  return seed("failCareerMapRecord");
}

export async function findCareerMapByToken(_token: string): Promise<CareerMapRecord | null> {
  return seed("findCareerMapByToken");
}

/** Saves the email on the map. Returns null when the token is unknown. */
export async function captureCareerMapEmail(_input: { token: string; email: string }): Promise<CareerMapRecord | null> {
  return seed("captureCareerMapEmail");
}

export async function markCareerMapEmailSent(_id: string): Promise<void> {
  return seed("markCareerMapEmailSent");
}

/** Links one map to a learner profile (idempotent; never steals a map linked to someone else). */
export async function linkCareerMapByToken(_input: { token: string; learnerProfileId: string }): Promise<CareerMapRecord | null> {
  return seed("linkCareerMapByToken");
}

/** Links every unlinked map captured with this email. Returns how many were linked. */
export async function linkCareerMapsByEmail(_input: { email: string; learnerProfileId: string }): Promise<number> {
  return seed("linkCareerMapsByEmail");
}

/** Latest completed map linked to the profile, or null. */
export async function getLatestCareerMapForProfile(_learnerProfileId: string): Promise<CareerMapRecord | null> {
  return seed("getLatestCareerMapForProfile");
}

/** Count of maps created since `sinceIso`, for one ip hash or (when ipHash is omitted) for everyone. */
export async function countRecentCareerMaps(_input: { ipHash?: string | null; sinceIso: string }): Promise<number> {
  return seed("countRecentCareerMaps");
}

export function resetCareerMapStateForTests(): void {
  seed("resetCareerMapStateForTests");
}
