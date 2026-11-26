import "server-only";
import { z } from "zod";
import { toCareerMapView, type CareerMapRecord, type CareerMapView, type ProofSite, type UserProfile } from "@aitutor/shared";
import { getLatestCareerMapForProfile } from "@/lib/career-map/store";
import { getProofSite } from "@/lib/proof/site-store";

/** Body of PUT /api/proof/site. Limits match the draft schema and the learner_profiles columns. */
export const proofSiteUpdateSchema = z.object({
  handle: z.string().trim().min(1).max(64),
  newTitle: z.string().trim().min(4).max(80),
  previousRole: z.string().trim().max(140).nullable().optional(),
  tagline: z.string().trim().min(8).max(140),
  bio: z.string().trim().min(40).max(1200),
  translations: z
    .array(z.object({ before: z.string().trim().min(4).max(110), now: z.string().trim().min(4).max(70) }))
    .min(1)
    .max(6),
  contactEmail: z.union([z.string().trim().email().max(254), z.literal("")]).nullable().optional(),
  linkedinUrl: z.string().trim().max(300).nullable().optional(),
});
export type ProofSiteUpdateInput = z.infer<typeof proofSiteUpdateSchema>;

export type ProofSiteState = {
  site: ProofSite | null;
  profile: { handle: string; name: string; published: boolean };
  map: CareerMapView | null;
};

/** Normalises a LinkedIn address. Returns null for empty input, "INVALID" for anything that is not linkedin.com over http(s). */
export function normalizeLinkedinUrl(input: string | null | undefined): string | null | "INVALID" {
  const value = input?.trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "INVALID";
    const host = parsed.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return "INVALID";
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return "INVALID";
  }
}

export async function loadLatestCompletedMap(learnerProfileId: string): Promise<CareerMapRecord | null> {
  const record = await getLatestCareerMapForProfile(learnerProfileId);
  if (!record || record.status !== "completed" || !record.map) return null;
  return record;
}

export async function buildProofSiteState(profile: UserProfile): Promise<ProofSiteState> {
  const [site, mapRecord] = await Promise.all([getProofSite(profile.id), loadLatestCompletedMap(profile.id)]);
  return {
    site,
    profile: { handle: profile.handle, name: profile.name, published: Boolean(profile.published) },
    map: mapRecord ? toCareerMapView(mapRecord) : null,
  };
}

/** Drops the cached public page so a save or unpublish shows at once. Best effort outside a Next request. */
export async function revalidatePublicProfile(handles: Array<string | null | undefined>) {
  try {
    const { revalidatePath } = await import("next/cache");
    for (const handle of new Set(handles.filter((value): value is string => Boolean(value)))) {
      revalidatePath(`/u/${handle}`);
    }
  } catch {
    // Not inside a Next.js request (tests, scripts). The page revalidates on its own timer.
  }
}
