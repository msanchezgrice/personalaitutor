import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/runtime";
import {
  captureAssessmentEmail,
  findAnonymousAssessmentByToken,
  getLatestAssessmentReport,
  markAssessmentReportEmailSent,
} from "@/lib/anonymous-assessment";
import { sendAssessmentReportEmail } from "@/lib/assessment-report-email";
import { getSiteUrl } from "@/lib/site";

const schema = z.object({
  sessionToken: z.string().min(20).max(200),
  email: z.string().email().max(320),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Enter a valid email address", 400, { issues: parsed.error.issues });
    }

    const existing = await findAnonymousAssessmentByToken(parsed.data.sessionToken);
    if (!existing) {
      return jsonError("SESSION_NOT_FOUND", "Assessment session not found", 404, {
        recoveryAction: "Restart the assessment",
      });
    }

    const captured = await captureAssessmentEmail({
      sessionToken: parsed.data.sessionToken,
      email: parsed.data.email,
    });
    if (!captured || !captured.email) {
      return jsonError("EMAIL_CAPTURE_FAILED", "Enter a valid email address", 400, {
        recoveryAction: "Check the email address and retry",
      });
    }

    const reportUrl = `${getSiteUrl()}/assessment/report/${encodeURIComponent(captured.sessionToken)}`;

    // Email delivery is best-effort; capture already succeeded.
    let emailed = false;
    const latestReport = await getLatestAssessmentReport(captured.id);
    if (latestReport) {
      try {
        emailed = await sendAssessmentReportEmail({
          to: captured.email,
          name: null,
          score: latestReport.readinessScore,
          headline: latestReport.report.headline,
          reportUrl,
        });
        if (emailed) {
          await markAssessmentReportEmailSent(captured.id);
        }
      } catch (error) {
        console.warn(
          "[assessment-email] report email send failed",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }

    return jsonOk({
      captured: true,
      emailed,
      reportPath: `/assessment/report/${encodeURIComponent(captured.sessionToken)}`,
    });
  } catch (error) {
    return jsonError("EMAIL_CAPTURE_FAILED", "Failed to capture email", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
