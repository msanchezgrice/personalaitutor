import { LIFECYCLE_EMAIL_KEYS } from "./lifecycle-email";

export const BILLING_CHECKOUT_REMINDER_KEYS = [
  "billing_checkout_reminder_1h",
  "billing_checkout_reminder_24h",
] as const;

export type BillingCheckoutReminderKey = (typeof BILLING_CHECKOUT_REMINDER_KEYS)[number];

export const EMAIL_CAMPAIGN_KEYS = [
  ...LIFECYCLE_EMAIL_KEYS,
  ...BILLING_CHECKOUT_REMINDER_KEYS,
] as const;

export type EmailCampaignKey = (typeof EMAIL_CAMPAIGN_KEYS)[number];

export const BILLING_CHECKOUT_REMINDER_DELAYS_MS: Record<BillingCheckoutReminderKey, number> = {
  billing_checkout_reminder_1h: 60 * 60 * 1000,
  billing_checkout_reminder_24h: 24 * 60 * 60 * 1000,
};

export function isBillingCheckoutReminderCampaign(
  value: string | null | undefined,
): value is BillingCheckoutReminderKey {
  return BILLING_CHECKOUT_REMINDER_KEYS.includes(value as BillingCheckoutReminderKey);
}

export function isBillingCheckoutReminderDue(input: {
  campaignKey: BillingCheckoutReminderKey;
  createdAt: string;
  now?: string;
}) {
  const createdAtMs = new Date(input.createdAt).getTime();
  const nowMs = new Date(input.now || new Date().toISOString()).getTime();
  if (Number.isNaN(createdAtMs) || Number.isNaN(nowMs)) return false;
  return nowMs - createdAtMs >= BILLING_CHECKOUT_REMINDER_DELAYS_MS[input.campaignKey];
}
