import "server-only";

import { CAREER_MAP_FIT_LABELS, getCareerMapTitle, type CareerMap } from "@aitutor/shared";
import { BRAND_NAME } from "@/lib/site";

/**
 * Sends the "keep this map" email: the visitor's new title and a link back to
 * their map. Best-effort like `lib/assessment-report-email.ts`: a missing
 * RESEND_API_KEY returns false, a Resend error returns false. Map generation
 * never depends on it.
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

export function buildCareerMapEmail(input: { map: CareerMap; mapUrl: string }) {
  const { map } = input;
  const newTitle = getCareerMapTitle(map.primary.titleId)?.title ?? map.primary.titleId;
  const oldTitle = map.person.previousTitle;
  const fitLabel = CAREER_MAP_FIT_LABELS[map.primary.fit];
  const firstName = map.person.displayName?.split(/\s+/)[0] ?? null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const translations = map.translations.slice(0, 4);
  const url = escapeHtml(input.mapUrl);

  const subject = `Your career map: ${oldTitle} to ${newTitle}`;

  const translationRows = translations
    .map(
      (entry) => `
        <tr>
          <td style="padding:8px 0;border-top:1px solid #e2e8f0;color:#475569;font-size:14px;line-height:1.5;">${escapeHtml(entry.before)}</td>
          <td style="padding:8px 0 8px 12px;border-top:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;line-height:1.5;">${escapeHtml(entry.now)}</td>
        </tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px">
        <div style="margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:700;">${escapeHtml(BRAND_NAME)}</div>
        <p style="margin:0 0 8px;color:#475569;">${escapeHtml(greeting)} here is the map you made.</p>
        <p style="margin:0 0 4px;font-size:13px;color:#64748b;">${escapeHtml(oldTitle)} &rarr;</p>
        <h1 style="margin:0 0 6px;font-size:26px;line-height:1.2;">${escapeHtml(newTitle)}</h1>
        <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#047857;">${escapeHtml(fitLabel)}</p>
        <p style="margin:0 0 18px;line-height:1.6;color:#334155;">${escapeHtml(map.primary.summary)}</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
          <tr>
            <th align="left" style="padding:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">What you did</th>
            <th align="left" style="padding:0 0 6px 12px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">What it is now</th>
          </tr>${translationRows}
        </table>
        <a href="${url}" style="display:inline-block;background:#047857;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">Open your map</a>
        <p style="margin:20px 0 0;font-size:12px;color:#64748b;">Or open this link: <a href="${url}" style="color:#047857;">${url}</a></p>
        <p style="margin:12px 0 0;font-size:12px;color:#64748b;">A career map is a starting hypothesis, not a hiring prediction.</p>
      </div>
    </div>
  `.trim();

  const text = [
    `${greeting} here is the map you made.`,
    "",
    `${oldTitle} -> ${newTitle} (${fitLabel})`,
    map.primary.summary,
    "",
    ...translations.map((entry) => `- ${entry.before} -> ${entry.now}`),
    "",
    `Open your map: ${input.mapUrl}`,
    "",
    "A career map is a starting hypothesis, not a hiring prediction.",
  ].join("\n");

  return { subject, html, text };
}

export async function sendCareerMapEmail(input: { to: string; map: CareerMap; mapUrl: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const { subject, html, text } = buildCareerMapEmail(input);
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
