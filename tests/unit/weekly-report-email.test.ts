import { describe, expect, test } from "vitest";
import {
  buildWeeklyReportEmail,
  deriveScoreTrend,
  isWeeklyReportCampaignKey,
  weeklyReportCampaignKey,
  type WeeklyReportContext,
} from "@aitutor/shared";
import { sendWeeklyReportsDue, type WeeklyReportCandidate } from "../../apps/web/lib/weekly-report";

const NOW = new Date("2026-07-07T13:00:00.000Z");

function contextFixture(overrides: Partial<WeeklyReportContext> = {}): WeeklyReportContext {
  return {
    baseUrl: "https://www.myaiskilltutor.com",
    learnerName: "Miguel",
    careerPathName: "Marketing & SEO",
    scoreTrend: { current: 52, weekAgo: 52, delta: 0 },
    gapsClosed: [],
    artifactsGenerated: [],
    streak: { current: 0, longest: 0 },
    landscapeChange: null,
    nextStep: "Close \"Programmatic SEO automation\" — start its tutor session.",
    ...overrides,
  };
}

describe("weekly report campaign key", () => {
  test("one key per ISO week", () => {
    expect(weeklyReportCampaignKey(new Date("2026-07-07T13:00:00Z"))).toBe("weekly_report_2026_w28");
    // Same ISO week -> same key.
    expect(weeklyReportCampaignKey(new Date("2026-07-12T23:00:00Z"))).toBe("weekly_report_2026_w28");
    // Next Monday -> next key.
    expect(weeklyReportCampaignKey(new Date("2026-07-13T01:00:00Z"))).toBe("weekly_report_2026_w29");
  });

  test("ISO week edge: early January belongs to the previous ISO year when applicable", () => {
    expect(weeklyReportCampaignKey(new Date("2027-01-01T12:00:00Z"))).toBe("weekly_report_2026_w53");
  });

  test("key pattern recognizer", () => {
    expect(isWeeklyReportCampaignKey("weekly_report_2026_w28")).toBe(true);
    expect(isWeeklyReportCampaignKey("welcome")).toBe(false);
    expect(isWeeklyReportCampaignKey(null)).toBe(false);
  });
});

describe("score trend derived from append-only history at send time", () => {
  test("newest score vs the score a week ago", () => {
    const trend = deriveScoreTrend(
      [
        { readinessScore: 52, createdAt: "2026-06-01T10:00:00Z" },
        { readinessScore: 55, createdAt: "2026-06-29T10:00:00Z" },
        { readinessScore: 58, createdAt: "2026-07-06T10:00:00Z" },
      ],
      NOW,
    );
    expect(trend).toEqual({ current: 58, weekAgo: 55, delta: 3 });
  });

  test("no history -> nulls; single point -> zero delta", () => {
    expect(deriveScoreTrend([], NOW)).toEqual({ current: null, weekAgo: null, delta: null });
    expect(deriveScoreTrend([{ readinessScore: 52, createdAt: "2026-07-06T10:00:00Z" }], NOW)).toEqual({
      current: 52,
      weekAgo: 52,
      delta: 0,
    });
  });

  test("downward moves are reported", () => {
    const trend = deriveScoreTrend(
      [
        { readinessScore: 60, createdAt: "2026-06-25T10:00:00Z" },
        { readinessScore: 57, createdAt: "2026-07-07T10:00:00Z" },
      ],
      NOW,
    );
    expect(trend.delta).toBe(-3);
  });
});

describe("weekly proof-of-watch email content", () => {
  test("a month-2 subscriber's email differs from their day-0 email", () => {
    const dayZero = buildWeeklyReportEmail(contextFixture(), NOW);

    const monthTwo = buildWeeklyReportEmail(
      contextFixture({
        scoreTrend: { current: 61, weekAgo: 58, delta: 3 },
        gapsClosed: ["Programmatic SEO"],
        artifactsGenerated: [{ title: "Generated website", url: "https://www.myaiskilltutor.com/generated/site-1" }],
        streak: { current: 6, longest: 9 },
        landscapeChange: {
          headline: "Bulk-content model ships",
          url: "https://real.example.com/top",
          source: "TechCrunch AI",
          summary: "Automates long-form SEO content.",
        },
        nextStep: "Close \"AI copy evaluation\" next.",
      }),
      new Date("2026-08-31T13:00:00.000Z"),
    );

    expect(monthTwo.subject).not.toBe(dayZero.subject);
    expect(monthTwo.html).not.toBe(dayZero.html);
    expect(monthTwo.campaignKey).not.toBe(dayZero.campaignKey);
    expect(monthTwo.subject).toContain("61/100");
    expect(monthTwo.subject).toContain("3");
    expect(monthTwo.html).toContain("6 days");
    expect(monthTwo.html).toContain("Programmatic SEO");
    expect(monthTwo.text).toContain("58 → 61/100");
  });

  test("landscape change cites the real briefing URL", () => {
    const email = buildWeeklyReportEmail(
      contextFixture({
        landscapeChange: {
          headline: "Bulk-content model ships",
          url: "https://real.example.com/top",
          source: "TechCrunch AI",
        },
      }),
      NOW,
    );
    expect(email.html).toContain("https://real.example.com/top");
    expect(email.text).toContain("TechCrunch AI — https://real.example.com/top");
  });

  test("empty week is honest, not fabricated", () => {
    const email = buildWeeklyReportEmail(contextFixture(), NOW);
    expect(email.text).toContain("No gap closed this week");
    expect(email.text).toContain("No new artifacts this week");
    expect(email.text).toContain("No landscape briefing was available");
    expect(email.html).not.toContain("undefined");
  });
});

describe("weekly sweep idempotency (computed at send time)", () => {
  const candidate: WeeklyReportCandidate = {
    learnerProfileId: "learner-1",
    externalUserId: "user_1",
    name: "Miguel",
    email: "miguel@example.com",
    careerPathId: "marketing-seo",
  };

  function makeDeps() {
    const sentLedger = new Map<string, string[]>();
    const sends: Array<{ to: string; subject: string }> = [];
    let computeCalls = 0;
    let contextScore = 52;

    const deps = {
      listActiveSubscribers: async () => [candidate],
      sentCampaignKeys: async (id: string) => sentLedger.get(id) ?? [],
      computeContext: async () => {
        computeCalls += 1;
        return contextFixture({ scoreTrend: { current: contextScore, weekAgo: 52, delta: contextScore - 52 } });
      },
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
    return {
      deps,
      sends,
      getComputeCalls: () => computeCalls,
      setScore: (value: number) => {
        contextScore = value;
      },
    };
  }

  test("sends once per ISO week, skips on re-run, sends again next week with fresh data", async () => {
    const harness = makeDeps();

    const first = await sendWeeklyReportsDue({ now: NOW, deps: harness.deps });
    expect(first.sent).toBe(1);
    expect(first.skipped).toBe(0);
    expect(first.campaignKey).toBe("weekly_report_2026_w28");

    // Same week re-run (e.g. cron retry) -> idempotent skip, no recompute, no resend.
    const retry = await sendWeeklyReportsDue({ now: new Date("2026-07-08T13:00:00Z"), deps: harness.deps });
    expect(retry.sent).toBe(0);
    expect(retry.skipped).toBe(1);
    expect(harness.sends).toHaveLength(1);
    expect(harness.getComputeCalls()).toBe(1);

    // Next week: data moved; the email is computed AT SEND TIME.
    harness.setScore(58);
    const nextWeek = await sendWeeklyReportsDue({ now: new Date("2026-07-14T13:00:00Z"), deps: harness.deps });
    expect(nextWeek.sent).toBe(1);
    expect(nextWeek.campaignKey).toBe("weekly_report_2026_w29");
    expect(harness.sends).toHaveLength(2);
    expect(harness.sends[1].subject).toContain("58/100");
    expect(harness.sends[1].subject).not.toBe(harness.sends[0].subject);
  });

  test("a failed send records failure and does NOT mark the week as sent", async () => {
    const harness = makeDeps();
    const failures: string[] = [];
    const deps = {
      ...harness.deps,
      sendEmail: async () => ({ ok: false as const, errorCode: "RESEND_RESPONSE_500" }),
      recordDelivery: async (input: { learnerProfileId: string; campaignKey: string; status: string }) => {
        failures.push(input.status);
        // failed rows are recorded but do not enter the sent ledger
      },
    };

    const result = await sendWeeklyReportsDue({ now: NOW, deps });
    expect(result.sent).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(failures).toEqual(["failed"]);

    // Retry can still send (nothing marked sent).
    const retry = await sendWeeklyReportsDue({ now: NOW, deps: harness.deps });
    expect(retry.sent).toBe(1);
  });
});
