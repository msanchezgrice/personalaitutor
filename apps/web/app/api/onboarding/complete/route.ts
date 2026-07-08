import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthSeed } from "@/lib/auth";
import { linkAnonymousAssessmentsToProfile } from "@/lib/anonymous-assessment";
import {
  jsonError,
  jsonOk,
  runtimeClaimOnboardingSession,
  runtimeFindOnboardingSession,
  runtimeStartAssessment,
  runtimeSubmitAssessment,
  runtimeUpdateOnboardingCareerImport,
  runtimeUpdateOnboardingSituation,
} from "@/lib/runtime";
import { verifyOnboardingSessionToken } from "@/lib/onboarding-session-token";
import { computeDeterministicAssessmentScore } from "@/lib/assessment-report";
import { resolveOnboardingReadiness } from "@/lib/onboarding-readiness";

const goalEnum = z.enum([
  "build_business",
  "upskill_current_job",
  "find_new_role",
  "showcase_for_job",
  "learn_foundations",
  "ship_ai_projects",
]);

const schema = z.object({
  sessionId: z.string().min(1),
  sessionToken: z.string().min(20),
  careerPathId: z.string().min(1),
  careerCategoryLabel: z.string().min(1).max(80).optional(),
  jobTitle: z.string().min(1).max(120).optional(),
  yearsExperience: z.enum(["0-1", "1-3", "3-5", "5-10", "10+"]).optional(),
  companySize: z.enum(["startup", "small", "medium", "large"]).optional().nullable(),
  aiComfort: z.number().int().min(1).max(5).optional(),
  linkedinUrl: z.string().url().optional().nullable(),
  resumeFilename: z.string().min(1).optional().nullable(),
  situation: z.enum(["employed", "unemployed", "student", "founder", "freelancer", "career_switcher"]),
  goals: z.array(goalEnum).min(1),
  answers: z.array(z.object({ questionId: z.string().min(1), value: z.number().min(0).max(5) })).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid onboarding completion payload", 400, { issues: parsed.error.issues });
    }

    const seed = await getAuthSeed(req);
    const payload = parsed.data;
    const existingSession = await runtimeFindOnboardingSession(payload.sessionId);
    if (!existingSession) {
      return jsonError("SESSION_NOT_FOUND", "Onboarding session was not found", 404, {
        recoveryAction: "Restart onboarding and retry the analysis step",
      });
    }

    const validToken = verifyOnboardingSessionToken(payload.sessionToken, {
      sessionId: payload.sessionId,
      userId: existingSession.userId,
    });
    if (!validToken) {
      return jsonError("UNAUTHORIZED_SESSION", "Onboarding session token is invalid or expired", 401, {
        recoveryAction: "Restart onboarding to refresh session access",
      });
    }

    const updatedCareer = await runtimeUpdateOnboardingCareerImport({
      sessionId: payload.sessionId,
      careerPathId: payload.careerPathId,
      careerCategoryLabel: payload.careerCategoryLabel,
      jobTitle: payload.jobTitle,
      yearsExperience: payload.yearsExperience,
      companySize: payload.companySize,
      aiComfort: payload.aiComfort,
      linkedinUrl: payload.linkedinUrl,
      resumeFilename: payload.resumeFilename,
    });
    if (!updatedCareer) {
      return jsonError("CAREER_IMPORT_FAILED", "Career import failed", 409, {
        recoveryAction: "Check your role details and retry the AI analysis step",
      });
    }

    const updatedSituation = await runtimeUpdateOnboardingSituation({
      sessionId: payload.sessionId,
      situation: payload.situation,
      goals: payload.goals,
    });
    if (!updatedSituation) {
      return jsonError("SITUATION_UPDATE_FAILED", "Unable to save situation and goals", 409, {
        recoveryAction: "Review your situation/goals and retry",
      });
    }

    const assessmentStart = await runtimeStartAssessment(updatedSituation.userId);
    if (!assessmentStart) {
      return jsonError("ASSESSMENT_START_FAILED", "Unable to start assessment", 409, {
        recoveryAction: "Retry onboarding analysis in a few seconds",
      });
    }

    const assessmentSubmit = await runtimeSubmitAssessment({
      assessmentId: assessmentStart.id,
      answers: payload.answers,
    });
    if (!assessmentSubmit) {
      return jsonError("ASSESSMENT_SUBMIT_FAILED", "Unable to submit assessment", 409, {
        recoveryAction: "Retry onboarding analysis in a few seconds",
      });
    }

    let claimed = false;
    let claimedUser: { id: string; handle: string; name: string; avatarUrl?: string | null } | null = null;
    if (seed?.userId) {
      const claimResult = await runtimeClaimOnboardingSession({
        sessionId: payload.sessionId,
        authUserId: seed.userId,
        seed: {
          name: seed.name,
          email: seed.email ?? null,
          handleBase: seed.handleBase,
          avatarUrl: seed.avatarUrl ?? null,
        },
      });
      if (!claimResult) {
        return jsonError("ONBOARDING_CLAIM_FAILED", "Unable to attach onboarding to signed-in profile", 409, {
          recoveryAction: "Open dashboard and retry session claim",
        });
      }
      claimed = true;
      claimedUser = {
        id: claimResult.user.id,
        handle: claimResult.user.handle,
        name: claimResult.user.name,
        avatarUrl: claimResult.user.avatarUrl ?? null,
      };

      // Attach any anonymous assessments taken before sign-up (matched on email).
      try {
        await linkAnonymousAssessmentsToProfile({
          learnerProfileId: claimResult.user.id,
          email: seed?.email ?? null,
        });
      } catch (error) {
        console.warn(
          "[assessment] anonymous assessment link failed",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }

    // UX audit F1: the deterministic score above is an internal signal only.
    // The user-facing finale shows the 0-100 AI-readiness score — reused from
    // a linked anonymous assessment when one exists, generated fresh (same
    // Phase 1 LLM report, same score spine) when none does. HARD FAILURE: a
    // failed generation fails loudly, never a placeholder.
    let readiness;
    try {
      readiness = await resolveOnboardingReadiness({
        email: seed?.email ?? null,
        learnerProfileId: claimedUser?.id ?? null,
        role: {
          careerPathId: payload.careerPathId,
          careerCategoryLabel: payload.careerCategoryLabel ?? null,
          jobTitle: payload.jobTitle ?? null,
          yearsExperience: payload.yearsExperience ?? null,
          companySize: payload.companySize ?? null,
          situation: payload.situation,
        },
        goals: payload.goals,
        aiComfort: payload.aiComfort ?? null,
        linkedinUrl: payload.linkedinUrl ?? null,
        answers: payload.answers,
        deterministicScore: computeDeterministicAssessmentScore(payload.answers),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN";
      const code = reason.startsWith("OPENAI_CONFIG_MISSING") ? "OPENAI_CONFIG_MISSING" : "READINESS_REPORT_FAILED";
      return jsonError(code, "Unable to generate your readiness report right now", 502, {
        reason: reason.slice(0, 300),
        recoveryAction: "Retry in a minute — your answers are saved",
      });
    }

    return jsonOk({
      session: updatedSituation,
      assessment: assessmentSubmit,
      readiness,
      signedIn: Boolean(seed?.userId),
      claimed,
      user: claimedUser,
    });
  } catch (error) {
    return jsonError("ONBOARDING_COMPLETE_FAILED", "Failed to complete onboarding", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
      recoveryAction: "Retry the AI analysis step after refreshing the page",
    });
  }
}
