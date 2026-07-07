import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sendAssessmentReportEmail } from "@/lib/assessment-report-email";

const input = {
  to: "person@example.com",
  name: "Jordan",
  score: 62,
  headline: "Strong instincts, weak systems.",
  reportUrl: "https://www.myaiskilltutor.com/assessment/report/tok_abc123",
};

describe("assessment report email", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("skips gracefully when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const sent = await sendAssessmentReportEmail(input);
    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sends via Resend with the score and report link", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const sent = await sendAssessmentReportEmail(input);
    expect(sent).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to).toEqual(["person@example.com"]);
    expect(body.subject).toContain("62");
    expect(body.html).toContain(input.reportUrl);
    expect(body.html).toContain("62");
    expect(body.text).toContain(input.reportUrl);
  });

  test("returns false when Resend rejects the send", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422 }));

    const sent = await sendAssessmentReportEmail(input);
    expect(sent).toBe(false);
  });
});
