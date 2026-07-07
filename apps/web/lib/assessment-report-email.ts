import "server-only";

import { BRAND_NAME } from "@/lib/site";

/**
 * Delivers the AI-readiness report link to the email captured at the end of
 * the anonymous assessment. Follows the repo's Resend pattern
 * (`sendWelcomeEmail` in runtime.ts): missing RESEND_API_KEY skips gracefully
 * (returns false) — email delivery is best-effort, unlike report generation.
 */

function fromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  return `${BRAND_NAME} <onboarding@resend.dev>`;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendAssessmentReportEmail(input: {
  to: string;
  name?: string | null;
  score: number;
  headline: string;
  reportUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const displayName = input.name?.trim() || "there";
  const safeHeadline = escapeHtml(input.headline);
  const subject = `Your AI-Readiness Score: ${input.score}/100`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px">
        <div style="display:flex;align-items:center;gap:10px;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:#10b981;color:#ffffff;font-size:14px;font-weight:700;">AI</span>
          <span style="font-size:15px;font-weight:700;letter-spacing:.2px;">${BRAND_NAME}</span>
        </div>
        <h1 style="margin:0 0 10px;font-size:24px;">Hi ${escapeHtml(displayName)}, your report is ready.</h1>
        <p style="margin:0 0 18px;line-height:1.6;color:#475569;">${safeHeadline}</p>
        <div style="margin:0 0 20px;text-align:center;">
          <div style="display:inline-block;padding:18px 28px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
            <div style="font-size:44px;font-weight:800;color:#10b981;line-height:1;">${input.score}</div>
            <div style="font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-top:6px;">AI-Readiness Score / 100</div>
          </div>
        </div>
        <p style="margin:0 0 20px;line-height:1.6;color:#475569;">
          Your full report covers your strengths, your skill gaps ranked by market impact, a recommended career path, and a 30-day plan to raise your score.
        </p>
        <a href="${input.reportUrl}" style="display:inline-block;background:#10b981;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">See Your Full Report</a>
        <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">Or open this link: <a href="${input.reportUrl}">${input.reportUrl}</a></p>
      </div>
    </div>
  `.trim();

  const text = [
    `Hi ${displayName}, your AI-readiness report is ready.`,
    `Score: ${input.score}/100`,
    input.headline,
    `Full report: ${input.reportUrl}`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [input.to],
      subject,
      html,
      text,
    }),
  });

  return res.ok;
}
