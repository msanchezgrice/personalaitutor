import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resetStateForTests } from "@aitutor/shared";

/**
 * Sign-up never auto-assigns a reserved handle (the fictional example
 * maya-ortiz, alex-chen-ai, example, admin, dashboard, api): the generator
 * skips it with a numeric suffix, the same way it resolves a clash.
 */

const { inserted, takenHandles } = vi.hoisted(() => ({ inserted: [] as Array<Record<string, unknown>>, takenHandles: new Set<string>() }));

/** Just enough of the Supabase query builder for profile creation. */
// Resolved the way apps/web resolves it (the package is not hoisted to the root).
vi.mock("../../apps/web/node_modules/@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let insertRow: Record<string, unknown> | null = null;
      const result = () => {
        if (insertRow) {
          inserted.push(insertRow);
          const now = new Date().toISOString();
          return { data: { ...insertRow, stripe_customer_id: null, created_at: now, updated_at: now }, error: null };
        }
        if (table === "learner_profiles" && typeof filters.handle === "string") {
          return { data: takenHandles.has(filters.handle) ? { id: "someone-else" } : null, error: null };
        }
        return { data: null, error: { message: "not found" } };
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        insert: (row: Record<string, unknown>) => {
          insertRow = row;
          return builder;
        },
        single: async () => result(),
        maybeSingle: async () => result(),
      };
      return builder;
    },
  }),
}));

import { RESERVED_PROFILE_HANDLES, avoidReservedProfileHandle, isReservedProfileHandle } from "@/lib/reserved-handles";
import { RESERVED_PROFILE_HANDLES as SITE_PROFILE_RESERVED, checkProfileHandleAvailable } from "@/lib/proof/site-profile";
import { runtimeGetOrCreateProfile } from "@/lib/runtime";

beforeEach(() => {
  resetStateForTests();
  inserted.length = 0;
  takenHandles.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("reserved handle list", () => {
  test("one list, shared by sign-up and the proof site handle check", () => {
    expect(SITE_PROFILE_RESERVED).toBe(RESERVED_PROFILE_HANDLES);
    for (const handle of ["maya-ortiz", "alex-chen-ai", "example", "admin", "dashboard", "api"]) {
      expect(isReservedProfileHandle(handle)).toBe(true);
    }
    expect(isReservedProfileHandle("maya-ortiz-2")).toBe(false);
    expect(avoidReservedProfileHandle("maya-ortiz")).toBe("maya-ortiz-2");
    expect(avoidReservedProfileHandle("sam-lee")).toBe("sam-lee");
  });

  test("the proof site handle check still refuses them", async () => {
    const check = await checkProfileHandleAvailable({ handle: "maya-ortiz", learnerProfileId: "anyone" });
    expect(check).toMatchObject({ ok: false, code: "HANDLE_TAKEN" });
  });
});

describe("sign-up handle generation (memory mode)", () => {
  test("a real Maya Ortiz gets maya-ortiz-2, not the example page's handle", async () => {
    const profile = await runtimeGetOrCreateProfile({ userId: "user_real_maya", name: "Maya Ortiz", handleBase: "maya-ortiz" });
    expect(profile.handle).toBe("maya-ortiz-2");
  });

  test("other reserved words are skipped too; ordinary handles are unchanged", async () => {
    for (const base of ["alex-chen-ai", "example", "admin", "dashboard", "api"]) {
      const profile = await runtimeGetOrCreateProfile({ userId: `user_${base}`, name: "Someone", handleBase: base });
      expect(profile.handle).toBe(`${base}-2`);
    }
    expect((await runtimeGetOrCreateProfile({ userId: "user_sam", name: "Sam Lee", handleBase: "sam-lee" })).handle).toBe("sam-lee");
  });
});

describe("sign-up handle generation (supabase mode)", () => {
  beforeEach(() => {
    vi.stubEnv("PERSISTENCE_MODE", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  });

  test("a reserved base is treated like a taken handle: maya-ortiz-2, then -3 when that is held", async () => {
    const first = await runtimeGetOrCreateProfile({ userId: "user_real_maya", name: "Maya Ortiz", handleBase: "maya-ortiz" });
    expect(first.handle).toBe("maya-ortiz-2");
    expect(inserted.at(-1)?.handle).toBe("maya-ortiz-2");

    takenHandles.add("maya-ortiz-2");
    const second = await runtimeGetOrCreateProfile({ userId: "user_other_maya", name: "Maya Ortiz", handleBase: "maya-ortiz" });
    expect(second.handle).toBe("maya-ortiz-3");
  });

  test("an ordinary free handle is used as is", async () => {
    const profile = await runtimeGetOrCreateProfile({ userId: "user_sam", name: "Sam Lee", handleBase: "sam-lee" });
    expect(profile.handle).toBe("sam-lee");
  });
});
