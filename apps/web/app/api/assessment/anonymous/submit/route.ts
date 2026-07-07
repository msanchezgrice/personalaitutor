import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/runtime";
import {
  appendAssessmentReport,
  findAnonymousAssessmentByToken,
  submitAnonymousAssessment,
} from "@/lib/anonymous-assessment";
import {
  computeDeterministicAssessmentScore,
  generateAssessmentReport,
} from "@/lib/assessment-report";

const goalEnum = z.enum([
  "build_business",
  "upskill_current_job",
  "find_new_role",
  "showcase_for_job",
  "learn_foundations",
  "ship_ai_projects",
]);

const schema = z.object({
  sessionToken: z.string().min(20).max(200),
  careerPathId: z.string().min(1).max(80),
  careerCategoryLabel: z.string().min(1).max(120).optional().nullable(),
  jobTitle: z.string().min(1).max(160).optional().nullable(),
  yearsExperience: z.enum(["0-1", "1-3", "3-5", "5-10", "10+"]).optional().nullable(),
  companySize: z.enum(["startup", "small", "medium", "large"]).optional().nullable(),
  situation: z.enum(["employed", "unemployed", "student", "founder", "freelancer", "career_switcher"]),
  goals: z.array(goalEnum).min(1),
  aiComfort: z.number().int().min(1).max(5).optional().nullable(),
  linkedinUrl: z.string().url().max(500).optional().nullable(),
  resumeText: z.string().max(20000).optional().nullable(),
  answers: z
    .array(z.object({ questionId: z.string().min(1).max(80), value: z.number().min(0).max(5) }))
    .min(1)
    .max(12),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid assessment submission", 400, { issues: parsed.error.issues });
    }
    const payload = parsed.data;

    const existing = await findAnonymousAssessmentByToken(payload.sessionToken);
    if (!existing) {
      return jsonError("SESSION_NOT_FOUND", "Assessment session not found", 404, {
        recoveryAction: "Restart the assessment",
      });
    }

    const submitted = await submitAnonymousAssessment({
      sessionToken: payload.sessionToken,
      careerPathId: payload.careerPathId,
      careerCategoryLabel: payload.careerCategoryLabel,
      jobTitle: payload.jobTitle,
      yearsExperience: payload.yearsExperience,
      companySize: payload.companySize,
      situation: payload.situation,
      goals: payload.goals,
      aiComfort: payload.aiComfort,
      linkedinUrl: payload.linkedinUrl,
      resumeText: payload.resumeText,
      answers: payload.answers,
    });
    if (!submitted) {
      return jsonError("ASSESSMENT_SUBMIT_FAILED", "Unable to save assessment answers", 409, {
        recoveryAction: "Retry in a few seconds",
      });
    }

    const deterministicScore = computeDeterministicAssessmentScore(payload.answers);

    // HARD FAILURE contract: a failed LLM generation fails loudly.
    // There is intentionally no fallback to rule-based report text.
    let generated;
    try {
      generated = await generateAssessmentReport({
        role: {
          careerPathId: submitted.careerPathId,
          careerCategoryLabel: submitted.careerCategoryLabel,
          jobTitle: submitted.jobTitle,
          yearsExperience: submitted.yearsExperience,
          companySize: submitted.companySize,
          situation: submitted.situation,
        },
        goals: submitted.goals,
        aiComfort: submitted.aiComfort,
        answers: submitted.answers,
        linkedinUrl: submitted.linkedinUrl,
        resumeText: submitted.resumeText,
        deterministicScore,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN";
      const code = reason.startsWith("OPENAI_CONFIG_MISSING") ? "OPENAI_CONFIG_MISSING" : "ASSESSMENT_REPORT_FAILED";
      return jsonError(code, "Unable to generate your report right now", 502, {
        reason: reason.slice(0, 300),
        recoveryAction: "Retry the analysis in a minute",
      });
    }

    const reportRecord = await appendAssessmentReport({
      anonymousAssessmentId: submitted.id,
      learnerProfileId: submitted.learnerProfileId,
      readinessScore: generated.report.readinessScore,
      deterministicScore,
      model: generated.model,
      report: generated.report,
    });

    return jsonOk({
      assessment: {
        id: submitted.id,
        status: submitted.status,
        submittedAt: submitted.submittedAt,
      },
      score: generated.report.readinessScore,
      report: generated.report,
      reportId: reportRecord.id,
      reportPath: `/assessment/report/${encodeURIComponent(submitted.sessionToken)}`,
    });
  } catch (error) {
    return jsonError("ASSESSMENT_SUBMIT_FAILED", "Failed to submit assessment", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
