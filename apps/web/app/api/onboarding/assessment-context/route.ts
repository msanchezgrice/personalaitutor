import { NextRequest } from "next/server";
import { getAuthSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/runtime";
import { findLatestAnonymousAssessmentByEmail, getLatestAssessmentReport } from "@/lib/anonymous-assessment";

export const dynamic = "force-dynamic";

/**
 * Onboarding prefill context (UX audit F2, 2026-07-07).
 *
 * When the signed-in user already completed the anonymous assessment
 * (matched on their email), onboarding must not re-ask the same questions:
 * this returns their captured basics + goals for prefill, and the readiness
 * report summary the finale reuses (F1). `linked: false` means the standard
 * multi-step flow runs.
 */
export async function GET(req: NextRequest) {
  try {
    const seed = await getAuthSeed(req);
    if (!seed?.userId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }

    const assessment = await findLatestAnonymousAssessmentByEmail(seed.email ?? null);
    if (!assessment) {
      return jsonOk({ linked: false });
    }

    const latestReport = await getLatestAssessmentReport(assessment.id);
    if (!latestReport) {
      // An assessment without a report cannot anchor the collapsed flow —
      // run full onboarding (which generates a fresh report, F1).
      return jsonOk({ linked: false });
    }

    return jsonOk({
      linked: true,
      assessment: {
        careerPathId: assessment.careerPathId,
        careerCategoryLabel: assessment.careerCategoryLabel,
        jobTitle: assessment.jobTitle,
        yearsExperience: assessment.yearsExperience,
        companySize: assessment.companySize,
        situation: assessment.situation,
        goals: assessment.goals,
        aiComfort: assessment.aiComfort,
        linkedinUrl: assessment.linkedinUrl,
      },
      report: {
        readinessScore: latestReport.readinessScore,
        headline: latestReport.report.headline,
        reportPath: `/assessment/report/${encodeURIComponent(assessment.sessionToken)}`,
      },
    });
  } catch (error) {
    return jsonError("ASSESSMENT_CONTEXT_FAILED", "Unable to load assessment context", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
