import "server-only";

import {
  getAnonymousAssessmentById,
  listAssessmentReportsForProfile,
} from "@/lib/anonymous-assessment";

/**
 * Dashboard read model for the AI-readiness score card (rebuild dashboard
 * batch item 1). The score history in `assessment_report_history` is
 * append-only — the latest entry is the living score, the entry before it
 * gives the delta.
 */
export type ReadinessScoreCardData =
  | {
      hasReport: true;
      score: number;
      /** Latest score minus the previous history entry; null with one entry. */
      delta: number | null;
      headline: string;
      /** Tokenized full-report page, when the source assessment still resolves. */
      reportUrl: string | null;
      updatedAt: string | null;
    }
  | { hasReport: false };

export async function getReadinessScoreCard(learnerProfileId: string): Promise<ReadinessScoreCardData> {
  const history = await listAssessmentReportsForProfile(learnerProfileId);
  if (!history.length) {
    return { hasReport: false };
  }

  const latest = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;

  const assessment = await getAnonymousAssessmentById(latest.anonymousAssessmentId).catch(() => null);
  const reportUrl = assessment?.sessionToken ? `/assessment/report/${assessment.sessionToken}` : null;

  return {
    hasReport: true,
    score: latest.readinessScore,
    delta: previous ? latest.readinessScore - previous.readinessScore : null,
    headline: latest.report.headline,
    reportUrl,
    updatedAt: latest.createdAt ?? null,
  };
}
