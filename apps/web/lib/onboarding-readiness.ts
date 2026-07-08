import "server-only";

import {
  appendAssessmentReport,
  captureAssessmentEmail,
  createAnonymousAssessment,
  findLatestAnonymousAssessmentByEmail,
  getLatestAssessmentReport,
  linkAnonymousAssessmentsToProfile,
  submitAnonymousAssessment,
} from "@/lib/anonymous-assessment";
import { generateAssessmentReport, type AssessmentAnswer } from "@/lib/assessment-report";

/**
 * Onboarding finale readiness routing (UX audit F1, 2026-07-07).
 *
 * The legacy deterministic "AI impact risk" output is never user-facing
 * anymore. The onboarding finale shows exactly one number — the 0-100
 * AI-readiness score:
 *
 * - If the signed-in user already earned a readiness report through the
 *   anonymous assessment (matched on email), reuse THAT report. No second
 *   score, no second framework.
 * - Otherwise generate the same Phase 1 LLM report from the onboarding
 *   inputs, persisted onto the same score spine (`anonymous_assessments` +
 *   `assessment_report_history`) so the dashboard card, report page, and
 *   re-scoring all keep working from one history.
 *
 * Failure contract: LLM failures bubble (`OPENAI_CONFIG_MISSING`,
 * `ASSESSMENT_REPORT_INVALID_OUTPUT`, ...) — never a placeholder report.
 */

export type OnboardingReadinessResult = {
  source: "linked" | "generated";
  readinessScore: number;
  headline: string;
  reportPath: string;
};

export type OnboardingReadinessInput = {
  email: string | null | undefined;
  learnerProfileId: string | null | undefined;
  role: {
    careerPathId?: string | null;
    careerCategoryLabel?: string | null;
    jobTitle?: string | null;
    yearsExperience?: string | null;
    companySize?: string | null;
    situation?: string | null;
  };
  goals: string[];
  aiComfort?: number | null;
  linkedinUrl?: string | null;
  resumeText?: string | null;
  answers: AssessmentAnswer[];
  deterministicScore: number;
};

function reportPathForToken(sessionToken: string) {
  return `/assessment/report/${encodeURIComponent(sessionToken)}`;
}

/**
 * The readiness report a user already earned anonymously, matched on email.
 * Returns null when there is no assessment OR the assessment has no report —
 * a report-less assessment row cannot anchor the finale.
 */
export async function findLinkedReadinessReport(
  email: string | null | undefined,
): Promise<OnboardingReadinessResult | null> {
  const assessment = await findLatestAnonymousAssessmentByEmail(email);
  if (!assessment) return null;

  const latest = await getLatestAssessmentReport(assessment.id);
  if (!latest) return null;

  return {
    source: "linked",
    readinessScore: latest.readinessScore,
    headline: latest.report.headline,
    reportPath: reportPathForToken(assessment.sessionToken),
  };
}

async function generateOnboardingReadinessReport(
  input: OnboardingReadinessInput,
): Promise<OnboardingReadinessResult> {
  // HARD FAILURE first: generate before persisting anything so an LLM outage
  // leaves no half-built assessment row on the happy path's spine.
  const generated = await generateAssessmentReport({
    role: input.role,
    goals: input.goals,
    aiComfort: input.aiComfort,
    answers: input.answers,
    linkedinUrl: input.linkedinUrl,
    resumeText: input.resumeText,
    deterministicScore: input.deterministicScore,
  });

  const created = await createAnonymousAssessment({ careerPathId: input.role.careerPathId ?? null });
  const submitted = await submitAnonymousAssessment({
    sessionToken: created.sessionToken,
    careerPathId: input.role.careerPathId,
    careerCategoryLabel: input.role.careerCategoryLabel,
    jobTitle: input.role.jobTitle,
    yearsExperience: input.role.yearsExperience,
    companySize: input.role.companySize,
    situation: input.role.situation,
    goals: input.goals,
    aiComfort: input.aiComfort,
    linkedinUrl: input.linkedinUrl,
    resumeText: input.resumeText,
    answers: input.answers,
  });
  if (!submitted) {
    throw new Error("ONBOARDING_READINESS_PERSIST_FAILED");
  }

  if (input.email) {
    await captureAssessmentEmail({ sessionToken: created.sessionToken, email: input.email });
  }

  await appendAssessmentReport({
    anonymousAssessmentId: submitted.id,
    learnerProfileId: input.learnerProfileId ?? null,
    readinessScore: generated.report.readinessScore,
    deterministicScore: input.deterministicScore,
    model: generated.model,
    report: generated.report,
  });

  // Idempotent: claims the row we just created (and any other unlinked ones).
  if (input.learnerProfileId && input.email) {
    await linkAnonymousAssessmentsToProfile({
      learnerProfileId: input.learnerProfileId,
      email: input.email,
    }).catch(() => 0);
  }

  return {
    source: "generated",
    readinessScore: generated.report.readinessScore,
    headline: generated.report.headline,
    reportPath: reportPathForToken(created.sessionToken),
  };
}

/**
 * F1 routing: linked report if one exists, otherwise generate one from the
 * onboarding inputs.
 */
export async function resolveOnboardingReadiness(
  input: OnboardingReadinessInput,
): Promise<OnboardingReadinessResult> {
  const linked = await findLinkedReadinessReport(input.email);
  if (linked) return linked;
  return generateOnboardingReadinessReport(input);
}
