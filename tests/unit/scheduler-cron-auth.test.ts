import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

class MockNextRequest extends Request {
  cookies = {
    get: vi.fn((_name: string) => undefined),
  };

  get nextUrl() {
    return new URL(this.url);
  }
}

vi.mock("next/server", () => ({
  NextRequest: MockNextRequest,
}));

// The GET handlers delegate to the sweep modules — mock the sweeps so these
// tests exercise ONLY the cron auth + response contract, with no network/DB.
vi.mock("../../apps/web/lib/daily-briefing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apps/web/lib/daily-briefing")>();
  return {
    ...actual,
    refreshAllDailyBriefings: vi.fn(async () => ({
      refreshed: ["marketing-seo", "software-engineering"],
      failures: [],
      feedsOk: 30,
      feedsFail: 5,
    })),
  };
});

vi.mock("../../apps/web/lib/daily-action", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apps/web/lib/daily-action")>();
  return {
    ...actual,
    runDailyRescoreSweep: vi.fn(async () => ({
      attempted: 2,
      created: 1,
      existing: 1,
      skipped: [],
      failed: [],
    })),
  };
});

vi.mock("../../apps/web/lib/weekly-report", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apps/web/lib/weekly-report")>();
  return {
    ...actual,
    sendWeeklyReportsDue: vi.fn(async () => ({
      campaignKey: "weekly_report_2026_w28",
      sent: 1,
      skipped: 0,
      failed: [],
    })),
  };
});

vi.mock("../../apps/web/lib/winback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apps/web/lib/winback")>();
  return {
    ...actual,
    sendWinbacksDue: vi.fn(async () => ({
      sent: 1,
      skipped: 2,
      failed: [],
      sentKeysByUser: [{ learnerProfileId: "learner-1", key: "winback_7" }],
    })),
  };
});

import { GET as newsRefreshGet } from "../../apps/web/app/api/scheduler/news-refresh/route";
import { GET as dailyUpdateGet } from "../../apps/web/app/api/scheduler/daily-update/route";
import { GET as weeklyReportGet, POST as weeklyReportPost } from "../../apps/web/app/api/scheduler/weekly-report/route";
import { GET as winbackGet } from "../../apps/web/app/api/scheduler/winback/route";

const SECRET = "test-cron-secret";

function cronRequest(path: string, options: { secret?: string | null; method?: string } = {}) {
  const headers = new Headers();
  if (options.secret) headers.set("authorization", `Bearer ${options.secret}`);
  return new MockNextRequest(`http://localhost${path}`, { method: options.method ?? "GET", headers });
}

type Handler = (req: InstanceType<typeof MockNextRequest>) => Promise<Response>;

const GET_HANDLERS: Array<[string, Handler, string]> = [
  ["/api/scheduler/news-refresh", newsRefreshGet as unknown as Handler, "news-refresh"],
  ["/api/scheduler/daily-update", dailyUpdateGet as unknown as Handler, "daily-update"],
  ["/api/scheduler/weekly-report", weeklyReportGet as unknown as Handler, "weekly-report"],
  ["/api/scheduler/winback", winbackGet as unknown as Handler, "winback"],
];

describe("scheduler cron GET auth (Vercel cron sends GET + Bearer CRON_SECRET)", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  for (const [path, handler, label] of GET_HANDLERS) {
    test(`${label}: 401 without a secret`, async () => {
      const response = await handler(cronRequest(path));
      expect(response.status).toBe(401);
      const payload = await response.json();
      expect(payload.ok).toBe(false);
    });

    test(`${label}: 401 with a wrong secret`, async () => {
      const response = await handler(cronRequest(path, { secret: "wrong-secret" }));
      expect(response.status).toBe(401);
    });

    test(`${label}: 200 with the correct secret`, async () => {
      const response = await handler(cronRequest(path, { secret: SECRET }));
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.ok).toBe(true);
    });
  }

  test("fails CLOSED when CRON_SECRET is unset — even a bearer header is rejected", async () => {
    delete process.env.CRON_SECRET;
    const response = await newsRefreshGet(
      cronRequest("/api/scheduler/news-refresh", { secret: "anything" }) as never,
    );
    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.error.code).toBe("CRON_SECRET_MISSING");
  });

  test("cron GET responses report sweep outcomes", async () => {
    const news = await (newsRefreshGet as unknown as Handler)(cronRequest("/api/scheduler/news-refresh", { secret: SECRET }));
    const newsPayload = await news.json();
    expect(newsPayload.refreshed).toContain("marketing-seo");

    const daily = await (dailyUpdateGet as unknown as Handler)(cronRequest("/api/scheduler/daily-update", { secret: SECRET }));
    const dailyPayload = await daily.json();
    expect(dailyPayload.created).toBe(1);

    const weekly = await (weeklyReportGet as unknown as Handler)(cronRequest("/api/scheduler/weekly-report", { secret: SECRET }));
    const weeklyPayload = await weekly.json();
    expect(weeklyPayload.campaignKey).toBe("weekly_report_2026_w28");

    const winback = await (winbackGet as unknown as Handler)(cronRequest("/api/scheduler/winback", { secret: SECRET }));
    const winbackPayload = await winback.json();
    expect(winbackPayload.sentKeysByUser[0].key).toBe("winback_7");
  });

  test("manual POST trigger on new sweep routes is also secret-guarded", async () => {
    const denied = await (weeklyReportPost as unknown as Handler)(
      cronRequest("/api/scheduler/weekly-report", { method: "POST" }),
    );
    expect(denied.status).toBe(401);

    const allowed = await (weeklyReportPost as unknown as Handler)(
      cronRequest("/api/scheduler/weekly-report", { secret: SECRET, method: "POST" }),
    );
    expect(allowed.status).toBe(200);
  });
});
