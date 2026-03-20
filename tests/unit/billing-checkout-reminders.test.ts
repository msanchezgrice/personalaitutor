import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";

const reminderModulePath = path.resolve(process.cwd(), "packages/shared/src/billing-checkout-reminders.ts");
const campaignModulePath = path.resolve(process.cwd(), "packages/shared/src/email-campaigns.ts");
const stripeServerPath = path.resolve(process.cwd(), "apps/web/lib/stripe-server.ts");
const workerPath = path.resolve(process.cwd(), "apps/worker/src/index.ts");

describe("billing checkout reminders", () => {
  test("builds sign-in resume links with checkout reminder tracking", async () => {
    expect(existsSync(reminderModulePath)).toBe(true);
    expect(existsSync(campaignModulePath)).toBe(true);
    if (!existsSync(reminderModulePath) || !existsSync(campaignModulePath)) return;

    const reminders = await import(pathToFileURL(reminderModulePath).href);
    const reminderUrl = reminders.buildBillingCheckoutReminderResumeUrl({
      baseUrl: "https://www.myaiskilltutor.com",
      returnTo: "/dashboard/projects",
      deliveryId: "delivery_123",
      campaignKey: "billing_checkout_reminder_24h",
    });

    const signInUrl = new URL(reminderUrl);
    expect(signInUrl.pathname).toBe("/sign-in");
    expect(signInUrl.searchParams.get("email_delivery_id")).toBe("delivery_123");
    expect(signInUrl.searchParams.get("email_campaign_key")).toBe("billing_checkout_reminder_24h");
    expect(signInUrl.searchParams.get("email_cta")).toBe("resume_trial_sign_in");

    const redirectUrl = signInUrl.searchParams.get("redirect_url");
    expect(redirectUrl).toBeTruthy();
    const checkoutResumeUrl = new URL(redirectUrl!);
    expect(checkoutResumeUrl.pathname).toBe("/dashboard");
    expect(checkoutResumeUrl.searchParams.get("billing")).toBe("required");
    expect(checkoutResumeUrl.searchParams.get("billing_resume")).toBe("1");
    expect(checkoutResumeUrl.searchParams.get("return_to")).toBe("/dashboard/projects");
    expect(checkoutResumeUrl.searchParams.get("email_delivery_id")).toBe("delivery_123");
    expect(checkoutResumeUrl.searchParams.get("email_campaign_key")).toBe("billing_checkout_reminder_24h");
    expect(checkoutResumeUrl.searchParams.get("email_cta")).toBe("resume_trial");
  });

  test("defines the reminder campaigns and due windows", async () => {
    expect(existsSync(campaignModulePath)).toBe(true);
    if (!existsSync(campaignModulePath)) return;

    const campaigns = await import(pathToFileURL(campaignModulePath).href);

    expect(campaigns.BILLING_CHECKOUT_REMINDER_KEYS).toEqual([
      "billing_checkout_reminder_1h",
      "billing_checkout_reminder_24h",
    ]);
    expect(
      campaigns.isBillingCheckoutReminderDue({
        campaignKey: "billing_checkout_reminder_1h",
        createdAt: "2026-03-19T10:00:00.000Z",
        now: "2026-03-19T10:59:59.000Z",
      }),
    ).toBe(false);
    expect(
      campaigns.isBillingCheckoutReminderDue({
        campaignKey: "billing_checkout_reminder_1h",
        createdAt: "2026-03-19T10:00:00.000Z",
        now: "2026-03-19T11:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      campaigns.isBillingCheckoutReminderDue({
        campaignKey: "billing_checkout_reminder_24h",
        createdAt: "2026-03-19T10:00:00.000Z",
        now: "2026-03-20T09:59:59.000Z",
      }),
    ).toBe(false);
    expect(
      campaigns.isBillingCheckoutReminderDue({
        campaignKey: "billing_checkout_reminder_24h",
        createdAt: "2026-03-19T10:00:00.000Z",
        now: "2026-03-20T10:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("wires queued reminder creation and worker delivery into the billing flow", () => {
    const stripeSource = readFileSync(stripeServerPath, "utf8");
    const workerSource = readFileSync(workerPath, "utf8");

    expect(stripeSource).toContain("replaceQueuedBillingReminderDeliveries");
    expect(stripeSource).toContain("cancelQueuedBillingReminderDeliveries");
    expect(stripeSource).toContain("resumeEmailDeliveryId");
    expect(stripeSource).toContain("resumeEmailCampaignKey");
    expect(workerSource).toContain("sendDueBillingCheckoutReminderEmails");
    expect(workerSource).toContain("maybeSendBillingCheckoutReminder");
    expect(workerSource).toContain("billingReminderMaxSendsPerRun");
    expect(workerSource).toContain("buildBillingCheckoutReminderResumeUrl");
  });
});
