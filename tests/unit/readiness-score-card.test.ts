import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
// eslint-disable-next-line import/no-relative-packages -- matches existing test convention
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { createElement } from "react";
import type { AssessmentReport } from "../../apps/web/lib/assessment-report";
import {
  appendAssessmentReport,
  createAnonymousAssessment,
  getAnonymousAssessmentById,
  resetAnonymousAssessmentStateForTests,
} from "../../apps/web/lib/anonymous-assessment";
import { getReadinessScoreCard } from "../../apps/web/lib/readiness-score";
import { ReadinessScoreCard } from "../../apps/web/components/readiness-score-card";

const PROFILE_ID = "learner-profile-readiness";

function report(score: number, headline = "Strong start, thin AI reps"): AssessmentReport {
  return {
    readinessScore: score,
    headline,
    summary: "Summary.",
    strengths: [{ title: "Depth", detail: "Knows the role." }],
    gaps: [{ title: "AI reps", whyItMatters: "Practice gap.", marketImpact: "high" }],
    recommendedPath: { careerPathId: "marketing-seo", reason: "Fit." },
    thirtyDayPlan: [{ week: 1, focus: "Reps", actions: ["One rep"] }],
  };
}

async function seedLinkedReport(score: number, headline?: string) {
  const assessment = await createAnonymousAssessment({ careerPathId: "marketing-seo" });
  await appendAssessmentReport({
    anonymousAssessmentId: assessment.id,
    learnerProfileId: PROFILE_ID,
    readinessScore: score,
    deterministicScore: 0.5,
    model: "gpt-4.1-mini",
    report: report(score, headline),
  });
  return assessment;
}

describe("readiness score card data (memory mode)", () => {
  beforeEach(() => {
    resetAnonymousAssessmentStateForTests();
  });

  test("no linked assessment -> hasReport false (CTA state)", async () => {
    const card = await getReadinessScoreCard(PROFILE_ID);
    expect(card).toEqual({ hasReport: false });
  });

  test("single report -> score + headline, no delta, tokenized report link", async () => {
    const assessment = await seedLinkedReport(52);
    const card = await getReadinessScoreCard(PROFILE_ID);
    expect(card.hasReport).toBe(true);
    if (!card.hasReport) return;
    expect(card.score).toBe(52);
    expect(card.delta).toBeNull();
    expect(card.headline).toBe("Strong start, thin AI reps");
    expect(card.reportUrl).toBe(`/assessment/report/${assessment.sessionToken}`);
  });

  test("score history yields the delta vs the previous entry", async () => {
    const assessment = await seedLinkedReport(52);
    await appendAssessmentReport({
      anonymousAssessmentId: assessment.id,
      learnerProfileId: PROFILE_ID,
      readinessScore: 57,
      deterministicScore: null,
      model: "gpt-4.1-mini",
      report: report(57, "Momentum building"),
    });

    const card = await getReadinessScoreCard(PROFILE_ID);
    expect(card.hasReport).toBe(true);
    if (!card.hasReport) return;
    expect(card.score).toBe(57);
    expect(card.delta).toBe(5);
    expect(card.headline).toBe("Momentum building");
  });

  test("getAnonymousAssessmentById returns the record and null for unknown ids", async () => {
    const assessment = await createAnonymousAssessment({ careerPathId: "marketing-seo" });
    expect((await getAnonymousAssessmentById(assessment.id))?.sessionToken).toBe(assessment.sessionToken);
    expect(await getAnonymousAssessmentById("missing")).toBeNull();
  });
});

describe("ReadinessScoreCard component", () => {
  test("renders score, positive delta, headline, and report link", () => {
    const html = renderToStaticMarkup(
      createElement(ReadinessScoreCard, {
        card: {
          hasReport: true,
          score: 57,
          delta: 5,
          headline: "Momentum building",
          reportUrl: "/assessment/report/tok_abc",
          updatedAt: "2026-07-07T00:00:00.000Z",
        },
      }),
    );
    expect(html).toContain("AI-Readiness Score");
    expect(html).toContain("57");
    expect(html).toContain("+5");
    expect(html).toContain("Momentum building");
    expect(html).toContain('href="/assessment/report/tok_abc"');
    expect(html).toContain("View full report");
  });

  test("renders a negative delta with its sign", () => {
    const html = renderToStaticMarkup(
      createElement(ReadinessScoreCard, {
        card: { hasReport: true, score: 49, delta: -3, headline: "Bar moved", reportUrl: null, updatedAt: null },
      }),
    );
    expect(html).toContain("-3");
    expect(html).not.toContain("View full report");
  });

  test("renders the assessment CTA when the user has no linked report", () => {
    const html = renderToStaticMarkup(createElement(ReadinessScoreCard, { card: { hasReport: false } }));
    expect(html).toContain("Get your AI-readiness score");
    expect(html).toContain('href="/assessment"');
    expect(html).not.toContain("View full report");
  });
});

describe("dashboard home mounts the readiness card", () => {
  test("card renders at the top of home content, above the daily-action card", () => {
    const source = readFileSync(path.resolve(process.cwd(), "apps/web/app/dashboard/page.tsx"), "utf8");
    expect(source).toContain("getReadinessScoreCard");
    const readinessIndex = source.indexOf("<ReadinessScoreCard");
    const dailyActionIndex = source.indexOf("<DailyActionCard");
    expect(readinessIndex).toBeGreaterThan(-1);
    expect(dailyActionIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBeLessThan(dailyActionIndex);
  });
});
