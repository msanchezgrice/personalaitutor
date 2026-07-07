import { beforeEach, describe, expect, test } from "vitest";
import {
  appendAssessmentReport,
  captureAssessmentEmail,
  createAnonymousAssessment,
  findAnonymousAssessmentByToken,
  getLatestAssessmentReport,
  linkAnonymousAssessmentsToProfile,
  listAssessmentReports,
  markAssessmentReportEmailSent,
  normalizeEmailAddress,
  resetAnonymousAssessmentStateForTests,
  submitAnonymousAssessment,
} from "@/lib/anonymous-assessment";

const sampleReport = {
  readinessScore: 61,
  headline: "h",
  summary: "s",
  strengths: [{ title: "t", detail: "d" }],
  gaps: [{ title: "g", whyItMatters: "w", marketImpact: "high" as const }],
  recommendedPath: { careerPathId: "operations", reason: "r" },
  thirtyDayPlan: [{ week: 1, focus: "f", actions: ["a"] }],
};

describe("anonymous assessment lifecycle", () => {
  beforeEach(() => {
    resetAnonymousAssessmentStateForTests();
  });

  test("creates a session keyed by an unguessable token", async () => {
    const first = await createAnonymousAssessment({ careerPathId: "product-management" });
    const second = await createAnonymousAssessment({});

    expect(first.sessionToken.length).toBeGreaterThanOrEqual(32);
    expect(second.sessionToken.length).toBeGreaterThanOrEqual(32);
    expect(first.sessionToken).not.toBe(second.sessionToken);
    expect(first.status).toBe("started");
    expect(first.careerPathId).toBe("product-management");
  });

  test("finds a session by token and returns null for unknown tokens", async () => {
    const created = await createAnonymousAssessment({});
    const found = await findAnonymousAssessmentByToken(created.sessionToken);
    expect(found?.id).toBe(created.id);
    expect(await findAnonymousAssessmentByToken("not-a-real-token")).toBeNull();
  });

  test("submit persists profile inputs and answers and marks status submitted", async () => {
    const created = await createAnonymousAssessment({});
    const submitted = await submitAnonymousAssessment({
      sessionToken: created.sessionToken,
      careerPathId: "marketing-seo",
      careerCategoryLabel: "Marketing",
      jobTitle: "Growth Lead",
      yearsExperience: "3-5",
      companySize: "small",
      situation: "employed",
      goals: ["upskill_current_job"],
      aiComfort: 4,
      linkedinUrl: "https://linkedin.com/in/growth",
      resumeText: "Ran lifecycle campaigns.",
      answers: [
        { questionId: "ai_tool_frequency", value: 4 },
        { questionId: "prompt_skill", value: 3 },
      ],
    });

    expect(submitted?.status).toBe("submitted");
    expect(submitted?.submittedAt).toBeTruthy();
    expect(submitted?.careerPathId).toBe("marketing-seo");
    expect(submitted?.answers).toHaveLength(2);
    expect(submitted?.resumeText).toContain("lifecycle");

    expect(
      await submitAnonymousAssessment({
        sessionToken: "unknown-token",
        careerPathId: "operations",
        situation: "employed",
        goals: [],
        answers: [],
      }),
    ).toBeNull();
  });

  test("score history appends a row per computation and preserves order", async () => {
    const created = await createAnonymousAssessment({});

    const first = await appendAssessmentReport({
      anonymousAssessmentId: created.id,
      readinessScore: 42,
      deterministicScore: 0.4,
      model: "gpt-4.1-mini",
      report: sampleReport,
    });
    const second = await appendAssessmentReport({
      anonymousAssessmentId: created.id,
      readinessScore: 55,
      deterministicScore: 0.5,
      model: "gpt-4.1-mini",
      report: { ...sampleReport, readinessScore: 55 },
    });

    expect(first.id).not.toBe(second.id);

    const history = await listAssessmentReports(created.id);
    expect(history).toHaveLength(2);
    expect(history[0].readinessScore).toBe(42);
    expect(history[1].readinessScore).toBe(55);

    const latest = await getLatestAssessmentReport(created.id);
    expect(latest?.id).toBe(second.id);
    expect(latest?.readinessScore).toBe(55);
  });

  test("captures a valid email once the report is ready", async () => {
    const created = await createAnonymousAssessment({});
    const updated = await captureAssessmentEmail({
      sessionToken: created.sessionToken,
      email: "  Person@Example.COM ",
    });

    expect(updated?.email).toBe("person@example.com");
    expect(updated?.emailCapturedAt).toBeTruthy();
    expect(updated?.status).toBe("completed");
  });

  test("rejects invalid emails without mutating the session", async () => {
    const created = await createAnonymousAssessment({});
    const rejected = await captureAssessmentEmail({
      sessionToken: created.sessionToken,
      email: "not-an-email",
    });
    expect(rejected).toBeNull();

    const untouched = await findAnonymousAssessmentByToken(created.sessionToken);
    expect(untouched?.email).toBeNull();
    expect(untouched?.status).toBe("started");
  });

  test("normalizeEmailAddress validates shape", () => {
    expect(normalizeEmailAddress("a@b.co")).toBe("a@b.co");
    expect(normalizeEmailAddress(" A@B.CO ")).toBe("a@b.co");
    expect(normalizeEmailAddress("nope")).toBeNull();
    expect(normalizeEmailAddress("nope@")).toBeNull();
    expect(normalizeEmailAddress("@nope.com")).toBeNull();
    expect(normalizeEmailAddress("")).toBeNull();
    expect(normalizeEmailAddress(undefined)).toBeNull();
  });

  test("marks the report email as sent", async () => {
    const created = await createAnonymousAssessment({});
    await captureAssessmentEmail({ sessionToken: created.sessionToken, email: "a@b.co" });
    const marked = await markAssessmentReportEmailSent(created.id);
    expect(marked?.reportEmailSentAt).toBeTruthy();
  });

  test("links anonymous assessments to a profile by email, idempotently", async () => {
    const a = await createAnonymousAssessment({});
    const b = await createAnonymousAssessment({});
    const other = await createAnonymousAssessment({});

    await captureAssessmentEmail({ sessionToken: a.sessionToken, email: "same@person.com" });
    await captureAssessmentEmail({ sessionToken: b.sessionToken, email: "same@person.com" });
    await captureAssessmentEmail({ sessionToken: other.sessionToken, email: "different@person.com" });

    await appendAssessmentReport({
      anonymousAssessmentId: a.id,
      readinessScore: 44,
      deterministicScore: 0.44,
      model: "gpt-4.1-mini",
      report: sampleReport,
    });

    const linkedCount = await linkAnonymousAssessmentsToProfile({
      learnerProfileId: "profile-123",
      email: "Same@Person.com",
    });
    expect(linkedCount).toBe(2);

    const linkedA = await findAnonymousAssessmentByToken(a.sessionToken);
    const linkedB = await findAnonymousAssessmentByToken(b.sessionToken);
    const notLinked = await findAnonymousAssessmentByToken(other.sessionToken);
    expect(linkedA?.learnerProfileId).toBe("profile-123");
    expect(linkedA?.linkedAt).toBeTruthy();
    expect(linkedB?.learnerProfileId).toBe("profile-123");
    expect(notLinked?.learnerProfileId).toBeNull();

    // Report history rows inherit the linked profile.
    const history = await listAssessmentReports(a.id);
    expect(history[0].learnerProfileId).toBe("profile-123");

    // Second run is a no-op (idempotent redundancy).
    const secondRun = await linkAnonymousAssessmentsToProfile({
      learnerProfileId: "profile-123",
      email: "same@person.com",
    });
    expect(secondRun).toBe(0);

    // A different profile cannot steal an already linked assessment.
    const thirdRun = await linkAnonymousAssessmentsToProfile({
      learnerProfileId: "profile-999",
      email: "same@person.com",
    });
    expect(thirdRun).toBe(0);
    expect((await findAnonymousAssessmentByToken(a.sessionToken))?.learnerProfileId).toBe("profile-123");
  });

  test("link is a no-op without a usable email or profile", async () => {
    expect(await linkAnonymousAssessmentsToProfile({ learnerProfileId: "", email: "a@b.co" })).toBe(0);
    expect(await linkAnonymousAssessmentsToProfile({ learnerProfileId: "p", email: "bad" })).toBe(0);
  });
});
