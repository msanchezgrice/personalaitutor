import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Proof site store: memory path end to end, and the Supabase path against a
 * fake service-role client (table, columns, upsert conflict key, row mapping).
 */

type Call = { method: string; args: unknown[] };
const supabaseState = vi.hoisted(() => ({
  calls: [] as Call[],
  result: { data: null as unknown, error: null as { message: string } | null },
}));

vi.mock("@/lib/supabase-admin", () => {
  function builder(): Record<string, (...args: unknown[]) => unknown> {
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ["select", "eq", "upsert", "update"]) {
      chain[method] = (...args: unknown[]) => {
        supabaseState.calls.push({ method, args });
        return chain;
      };
    }
    chain.maybeSingle = async () => supabaseState.result;
    chain.single = async () => supabaseState.result;
    return chain;
  }
  return {
    getSupabaseAdminClient: () => ({
      from: (table: string) => {
        supabaseState.calls.push({ method: "from", args: [table] });
        return builder();
      },
    }),
  };
});

import {
  getProofSite,
  getProofSiteStatus,
  resetProofSiteStateForTests,
  upsertProofSite,
} from "@/lib/proof/site-store";

const BASE = {
  learnerProfileId: "profile-store-1",
  careerMapId: "map-1",
  newTitle: "Go-to-Market Engineer",
  previousRole: "Senior Marketing Manager at a game studio",
  tagline: "I turn launch plans into AI workflows.",
  bio: "Seven years of launches and lifecycle email, now built as AI workflows.",
  translations: [{ before: "Planned 4 global game launches", now: "Builds AI launch workflows" }],
  contactEmail: "me@example.com",
  linkedinUrl: null,
};

describe("proof site store (memory)", () => {
  beforeEach(() => resetProofSiteStateForTests());

  test("returns null before anything is saved", async () => {
    expect(await getProofSite("profile-store-1")).toBeNull();
    expect(await getProofSite("")).toBeNull();
  });

  test("creates, then updates in place keeping createdAt", async () => {
    const created = await upsertProofSite(BASE);
    expect(created.newTitle).toBe("Go-to-Market Engineer");
    expect(created.createdAt).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await upsertProofSite({ ...BASE, tagline: "I build the systems a launch team runs on." });
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
    expect((await getProofSite(BASE.learnerProfileId))?.tagline).toBe("I build the systems a launch team runs on.");
  });

  test("returns copies, so callers cannot mutate stored state", async () => {
    await upsertProofSite(BASE);
    const first = await getProofSite(BASE.learnerProfileId);
    first!.translations[0].now = "mutated";
    first!.newTitle = "mutated";
    const second = await getProofSite(BASE.learnerProfileId);
    expect(second?.newTitle).toBe("Go-to-Market Engineer");
    expect(second?.translations[0].now).toBe("Builds AI launch workflows");
  });

  test("drops malformed translation rows and requires a learner id", async () => {
    const saved = await upsertProofSite({
      ...BASE,
      translations: [{ before: "  ", now: "x" }, { before: "Wrote emails", now: "Writes prompts" }] as never,
    });
    expect(saved.translations).toEqual([{ before: "Wrote emails", now: "Writes prompts" }]);
    await expect(upsertProofSite({ ...BASE, learnerProfileId: "" })).rejects.toThrow("PROOF_SITE_UPSERT_FAILED");
  });

  test("status covers empty, draft and live", async () => {
    expect(await getProofSiteStatus({ learnerProfileId: BASE.learnerProfileId, published: false })).toMatchObject({ state: "empty" });
    await upsertProofSite(BASE);
    expect(await getProofSiteStatus({ learnerProfileId: BASE.learnerProfileId, published: false })).toMatchObject({ state: "draft" });
    const live = await getProofSiteStatus({ learnerProfileId: BASE.learnerProfileId, published: true });
    expect(live.state).toBe("live");
    expect(live.summary.length).toBeGreaterThan(5);
  });
});

describe("proof site store (supabase)", () => {
  beforeEach(() => {
    vi.stubEnv("PERSISTENCE_MODE", "supabase");
    supabaseState.calls = [];
    supabaseState.result = { data: null, error: null };
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const ROW = {
    learner_profile_id: "8b1f4f8e-1111-4b8f-9a3e-0f6d2b7c1a10",
    career_map_id: null,
    new_title: "Model Evaluator",
    previous_role: null,
    tagline: "I write the tests that show where AI fails.",
    bio: "Six years of QA, now writing evaluation suites for AI systems.",
    translations: [{ before: "Wrote 400 test cases", now: "Writes eval sets" }, { bad: true }],
    contact_email: null,
    linkedin_url: "https://www.linkedin.com/in/someone/",
    created_at: "2026-11-20T10:00:00.000Z",
    updated_at: "2026-11-21T10:00:00.000Z",
  };

  test("reads proof_sites by learner_profile_id and maps the row", async () => {
    supabaseState.result = { data: ROW, error: null };
    const site = await getProofSite(ROW.learner_profile_id);
    expect(supabaseState.calls[0]).toEqual({ method: "from", args: ["proof_sites"] });
    expect(supabaseState.calls).toContainEqual({ method: "eq", args: ["learner_profile_id", ROW.learner_profile_id] });
    expect(site).toEqual({
      learnerProfileId: ROW.learner_profile_id,
      careerMapId: null,
      newTitle: "Model Evaluator",
      previousRole: null,
      tagline: ROW.tagline,
      bio: ROW.bio,
      translations: [{ before: "Wrote 400 test cases", now: "Writes eval sets" }],
      contactEmail: null,
      linkedinUrl: ROW.linkedin_url,
      createdAt: ROW.created_at,
      updatedAt: ROW.updated_at,
    });
  });

  test("a missing row is null and a read error throws", async () => {
    expect(await getProofSite(ROW.learner_profile_id)).toBeNull();
    supabaseState.result = { data: null, error: { message: "boom" } };
    await expect(getProofSite(ROW.learner_profile_id)).rejects.toThrow("PROOF_SITE_READ_FAILED:boom");
  });

  test("upserts on learner_profile_id with snake_case columns and never sends created_at", async () => {
    supabaseState.result = { data: ROW, error: null };
    await upsertProofSite({ ...BASE, learnerProfileId: ROW.learner_profile_id });
    const upsert = supabaseState.calls.find((call) => call.method === "upsert");
    expect(upsert).toBeTruthy();
    const [payload, options] = upsert!.args as [Record<string, unknown>, Record<string, unknown>];
    expect(options).toEqual({ onConflict: "learner_profile_id" });
    expect(payload).toMatchObject({
      learner_profile_id: ROW.learner_profile_id,
      career_map_id: "map-1",
      new_title: BASE.newTitle,
      previous_role: BASE.previousRole,
      tagline: BASE.tagline,
      bio: BASE.bio,
      translations: BASE.translations,
      contact_email: BASE.contactEmail,
      linkedin_url: null,
    });
    expect(payload).not.toHaveProperty("created_at");
    expect(typeof payload.updated_at).toBe("string");
  });

  test("an upsert error throws a coded error", async () => {
    supabaseState.result = { data: null, error: { message: "fk violation" } };
    await expect(upsertProofSite({ ...BASE, learnerProfileId: ROW.learner_profile_id })).rejects.toThrow("PROOF_SITE_UPSERT_FAILED:fk violation");
  });
});
