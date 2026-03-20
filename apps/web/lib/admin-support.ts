import { runtimeListSignupAuditRecords, type SignupAuditRecord } from "@/lib/runtime";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type AdminSupportInboxRow = {
  userId: string;
  email: string;
  name: string;
  source: string;
  onboardingStatus: string;
  billingStatus: string;
  projectCount: number;
  chatMessageCount: number;
  lastCustomerMessageAt: string | null;
  latestMessagePreview: string | null;
  joinedAt: string;
};

function displaySource(record: SignupAuditRecord) {
  const last = record.onboarding?.acquisition?.last ?? record.profile.acquisition?.last;
  const first = record.onboarding?.acquisition?.first ?? record.profile.acquisition?.first;
  return last?.utmSource || first?.utmSource || "unknown";
}

function onboardingStatus(record: SignupAuditRecord) {
  return record.onboarding?.status ?? "not_started";
}

function latestCustomerTouch(record: SignupAuditRecord) {
  return (
    record.chat.lastUserMessageAt ||
    record.assessment?.submittedAt ||
    record.onboarding?.updatedAt ||
    record.welcomeEmailSentAt ||
    record.profile.updatedAt
  );
}

export async function listAdminSupportInboxRows(input?: {
  days?: number;
  limit?: number;
  search?: string | null;
}) {
  const records = await runtimeListSignupAuditRecords({
    days: input?.days ?? 90,
    limit: input?.limit ?? 200,
    search: input?.search ?? undefined,
  });

  if (!records.length) {
    return [] as AdminSupportInboxRow[];
  }

  const supabase = getSupabaseAdminClient();
  const userIds = records.map((record) => record.profile.id);
  const { data: subscriptions } = await supabase
    .from("billing_subscriptions")
    .select("learner_profile_id,status")
    .in("learner_profile_id", userIds);

  const billingByUser = new Map<string, string>();
  for (const row of subscriptions ?? []) {
    if (row?.learner_profile_id) {
      billingByUser.set(String(row.learner_profile_id), String(row.status ?? "none"));
    }
  }

  return records
    .map((record) => ({
      userId: record.profile.id,
      email: record.profile.contactEmail || record.profile.handle,
      name: record.profile.name || "Unnamed learner",
      source: displaySource(record),
      onboardingStatus: onboardingStatus(record),
      billingStatus: billingByUser.get(record.profile.id) ?? "none",
      projectCount: record.projectCount,
      chatMessageCount: record.chat.userMessageCount,
      lastCustomerMessageAt: latestCustomerTouch(record),
      latestMessagePreview: record.chat.lastUserMessage,
      joinedAt: record.profile.createdAt,
    }))
    .sort((left, right) => {
      const time = (right.lastCustomerMessageAt || "").localeCompare(left.lastCustomerMessageAt || "");
      if (time !== 0) return time;
      return right.joinedAt.localeCompare(left.joinedAt);
    }) satisfies AdminSupportInboxRow[];
}
