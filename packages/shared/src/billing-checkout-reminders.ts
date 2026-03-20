import { appendLifecycleEmailTracking } from "./email-tracking";
import { type BillingCheckoutReminderKey } from "./email-campaigns";
import { EMAIL_PRODUCT_NAME } from "./lifecycle-email";

type BillingCheckoutReminderTemplate = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeDashboardReturnTo(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/dashboard") || normalized.startsWith("//")) {
    return "/dashboard";
  }
  return normalized || "/dashboard";
}

function normalizeBaseUrl(input: string) {
  return input.replace(/\/+$/, "");
}

function firstName(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.split(/\s+/)[0] || "there" : "there";
}

function renderEmail(input: {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
}) {
  const htmlParagraphs = input.paragraphs
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph)}</p>`)
    .join("");

  const html = `
    <div style="margin:0;background:#f8fafc;padding:32px 16px;color:#0f172a;font-family:Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:36px 32px;">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#10b981;">
          ${escapeHtml(input.eyebrow)}
        </p>
        <h1 style="margin:0 0 18px;font-size:32px;line-height:1.1;color:#0f172a;">
          ${escapeHtml(input.title)}
        </h1>
        <div style="font-size:16px;line-height:1.7;color:#334155;">
          ${htmlParagraphs}
        </div>
        <p style="margin:28px 0 0;">
          <a
            href="${escapeHtml(input.ctaUrl)}"
            style="display:inline-block;border-radius:999px;background:#10b981;padding:14px 20px;color:#ffffff;text-decoration:none;font-weight:700;"
          >
            ${escapeHtml(input.ctaLabel)}
          </a>
        </p>
        <p style="margin-top:24px;color:#64748b;">${escapeHtml(input.footer)}</p>
      </div>
    </div>
  `.trim();

  const text = [
    input.title,
    "",
    ...input.paragraphs,
    "",
    `${input.ctaLabel}: ${input.ctaUrl}`,
    "",
    input.footer,
  ].join("\n");

  return { html, text };
}

export function buildBillingCheckoutReminderResumeUrl(input: {
  baseUrl: string;
  returnTo?: string | null;
  deliveryId: string;
  campaignKey: BillingCheckoutReminderKey;
}) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const resumeUrl = new URL(`${baseUrl}/dashboard`);
  resumeUrl.searchParams.set("billing", "required");
  resumeUrl.searchParams.set("billing_resume", "1");
  resumeUrl.searchParams.set("return_to", sanitizeDashboardReturnTo(input.returnTo));

  const trackedResumeUrl = appendLifecycleEmailTracking({
    url: resumeUrl.toString(),
    campaignKey: input.campaignKey,
    deliveryId: input.deliveryId,
    cta: "resume_trial",
  });

  const signInUrl = new URL(`${baseUrl}/sign-in`);
  signInUrl.searchParams.set("redirect_url", trackedResumeUrl);

  return appendLifecycleEmailTracking({
    url: signInUrl.toString(),
    campaignKey: input.campaignKey,
    deliveryId: input.deliveryId,
    cta: "resume_trial_sign_in",
  });
}

export function buildBillingCheckoutReminderEmail(input: {
  campaignKey: BillingCheckoutReminderKey;
  learnerName?: string | null;
  resumeUrl: string;
}): BillingCheckoutReminderTemplate {
  const learnerFirstName = firstName(input.learnerName);
  const isEarlyReminder = input.campaignKey === "billing_checkout_reminder_1h";
  const subject = isEarlyReminder
    ? `Pick up where you left off with your ${EMAIL_PRODUCT_NAME} trial`
    : `Your ${EMAIL_PRODUCT_NAME} trial is still waiting`;
  const previewText = isEarlyReminder
    ? `Your ${EMAIL_PRODUCT_NAME} dashboard is ready when you are.`
    : `Start your 7-day ${EMAIL_PRODUCT_NAME} trial when you are ready to ship.`;
  const rendered = renderEmail({
    eyebrow: "Billing Reminder",
    title: isEarlyReminder
      ? `${learnerFirstName}, your ${EMAIL_PRODUCT_NAME} trial is still ready`
      : `Your ${EMAIL_PRODUCT_NAME} dashboard is still waiting`,
    paragraphs: [
      "Your 7-day free trial is still available, and your personalized modules are ready the moment you jump back in.",
      "You will unlock Chat Tutor, daily AI news, social/build-log tools, and the guided project workbench in one dashboard.",
      isEarlyReminder
        ? "Card required today, but you will not be charged until the 7-day trial ends."
        : "If you still want to build with a clear path instead of figuring it out alone, come back through this link and resume your trial.",
    ],
    ctaLabel: "Resume your trial",
    ctaUrl: input.resumeUrl,
    footer: "Auto-renews at $49.99/month unless canceled before trial end.",
  });

  return {
    subject,
    previewText,
    html: rendered.html,
    text: rendered.text,
  };
}
