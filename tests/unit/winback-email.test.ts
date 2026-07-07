import { describe, expect, test } from "vitest";
import { buildWinbackEmail, isWinbackCampaignKey, resolveWinbackKey } from "@aitutor/shared";
import { sendWinbacksDue, type WinbackCandidate } from "../../apps/web/lib/winback";

const NOW_ISO = "2026-07-31T12:00:00.000Z";

function daysAgo(days: number): string {
  return new Date(Date.parse(NOW_ISO) - days * 86_400_000).toISOString();
}

describe("winback windows", () => {
  test("active users get nothing", () => {
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(2), sentKeys: [], nowIso: NOW_ISO })).toBeNull();
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(6.9), sentKeys: [], nowIso: NOW_ISO })).toBeNull();
  });

  test("7, 14, and 30 day windows fire the matching key", () => {
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(7), sentKeys: [], nowIso: NOW_ISO })).toBe("winback_7");
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(13), sentKeys: [], nowIso: NOW_ISO })).toBe("winback_7");
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(14), sentKeys: [], nowIso: NOW_ISO })).toBe("winback_14");
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(29), sentKeys: [], nowIso: NOW_ISO })).toBe("winback_14");
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(30), sentKeys: [], nowIso: NOW_ISO })).toBe("winback_30");
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(90), sentKeys: [], nowIso: NOW_ISO })).toBe("winback_30");
  });

  test("already-sent keys never repeat (idempotent windows)", () => {
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(8), sentKeys: ["winback_7"], nowIso: NOW_ISO })).toBeNull();
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(15), sentKeys: ["winback_14"], nowIso: NOW_ISO })).toBeNull();
    // 15 days out with only winback_7 sent -> 14-day stage fires.
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(15), sentKeys: ["winback_7"], nowIso: NOW_ISO })).toBe(
      "winback_14",
    );
    expect(
      resolveWinbackKey({
        lastActiveAt: daysAgo(45),
        sentKeys: ["winback_7", "winback_14", "winback_30"],
        nowIso: NOW_ISO,
      }),
    ).toBeNull();
  });

  test("the CURRENT stage fires; earlier missed stages are not replayed", () => {
    // User went dark 35 days ago and never got any winback -> only winback_30.
    expect(resolveWinbackKey({ lastActiveAt: daysAgo(35), sentKeys: [], nowIso: NOW_ISO })).toBe("winback_30");
  });

  test("missing/garbage lastActiveAt -> nothing (never guess)", () => {
    expect(resolveWinbackKey({ lastActiveAt: null, sentKeys: [], nowIso: NOW_ISO })).toBeNull();
    expect(resolveWinbackKey({ lastActiveAt: "garbage", sentKeys: [], nowIso: NOW_ISO })).toBeNull();
  });

  test("key recognizer", () => {
    expect(isWinbackCampaignKey("winback_7")).toBe(true);
    expect(isWinbackCampaignKey("winback_31")).toBe(false);
  });
});

describe("winback email is anchored to the learner's report", () => {
  test("gap plan count and top gap title appear", () => {
    const email = buildWinbackEmail({
      key: "winback_7",
      baseUrl: "https://www.myaiskilltutor.com",
      learnerName: "Miguel",
      careerPathName: "Marketing & SEO",
      readinessScore: 52,
      unfinishedGapCount: 3,
      topGapTitle: "Programmatic SEO automation",
    });
    expect(email.subject).toContain("your gap plan has 3 unfinished steps");
    expect(email.text).toContain("52/100");
    expect(email.text).toContain("Programmatic SEO automation");
    expect(email.html).toContain("https://www.myaiskilltutor.com/dashboard/");
  });

  test("each stage has distinct framing", () => {
    const base = {
      baseUrl: "https://www.myaiskilltutor.com",
      learnerName: "Miguel",
      careerPathName: "Marketing & SEO",
      readinessScore: 52,
      unfinishedGapCount: 2,
      topGapTitle: "AI copy evaluation",
    };
    const seven = buildWinbackEmail({ ...base, key: "winback_7" });
    const fourteen = buildWinbackEmail({ ...base, key: "winback_14" });
    const thirty = buildWinbackEmail({ ...base, key: "winback_30" });
    expect(new Set([seven.subject, fourteen.subject, thirty.subject]).size).toBe(3);
    expect(thirty.text).toContain("30");
  });

  test("no report yet degrades honestly", () => {
    const email = buildWinbackEmail({
      key: "winback_7",
      baseUrl: "https://www.myaiskilltutor.com",
      learnerName: "Miguel",
      careerPathName: null,
      readinessScore: null,
      unfinishedGapCount: 0,
      topGapTitle: null,
    });
    expect(email.text).toContain("waiting on your first assessment");
    expect(email.html).not.toContain("null");
  });
});

describe("winback sweep idempotency", () => {
  function makeHarness(lastActiveDaysAgo: number) {
    const sentLedger = new Map<string, string[]>();
    const sends: Array<{ to: string; subject: string }> = [];

    const candidate: WinbackCandidate = {
      learnerProfileId: "learner-1",
      externalUserId: "user_1",
      name: "Miguel",
      email: "miguel@example.com",
      careerPathName: "Marketing & SEO",
      lastActiveAt: daysAgo(lastActiveDaysAgo),
    };

    const deps = {
      listCandidates: async () => [candidate],
      sentCampaignKeys: async (id: string) => sentLedger.get(id) ?? [],
      loadAnchor: async () => ({
        readinessScore: 52,
        unfinishedGapCount: 3,
        topGapTitle: "Programmatic SEO automation",
      }),
      sendEmail: async (input: { to: string; subject: string }) => {
        sends.push({ to: input.to, subject: input.subject });
        return { ok: true as const, messageId: `msg-${sends.length}` };
      },
      recordDelivery: async (input: { learnerProfileId: string; campaignKey: string; status: string }) => {
        if (input.status === "sent") {
          const keys = sentLedger.get(input.learnerProfileId) ?? [];
          sentLedger.set(input.learnerProfileId, [...keys, input.campaignKey]);
        }
      },
    };
    return { deps, sends, sentLedger };
  }

  test("sends the due stage once; the daily cron re-run skips it", async () => {
    const harness = makeHarness(8);
    const now = new Date(NOW_ISO);

    const first = await sendWinbacksDue({ now, deps: harness.deps });
    expect(first.sent).toBe(1);
    expect(first.sentKeysByUser).toEqual([{ learnerProfileId: "learner-1", key: "winback_7" }]);

    const rerun = await sendWinbacksDue({ now, deps: harness.deps });
    expect(rerun.sent).toBe(0);
    expect(rerun.skipped).toBe(1);
    expect(harness.sends).toHaveLength(1);
  });

  test("stages escalate across weeks without replaying earlier ones", async () => {
    const harness = makeHarness(8);
    await sendWinbacksDue({ now: new Date(NOW_ISO), deps: harness.deps });

    // A week later the same user is 15 days inactive -> winback_14 fires.
    const later = new Date(Date.parse(NOW_ISO) + 7 * 86_400_000);
    const second = await sendWinbacksDue({ now: later, deps: harness.deps });
    expect(second.sent).toBe(1);
    expect(second.sentKeysByUser[0].key).toBe("winback_14");
    expect(harness.sends).toHaveLength(2);
  });

  test("recently active users are skipped entirely", async () => {
    const harness = makeHarness(2);
    const result = await sendWinbacksDue({ now: new Date(NOW_ISO), deps: harness.deps });
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(harness.sends).toHaveLength(0);
  });
});
