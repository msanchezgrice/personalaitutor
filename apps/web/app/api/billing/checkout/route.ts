import { NextRequest } from "next/server";
import { BILLING_CHECKOUT_REMINDER_KEYS } from "@aitutor/shared";
import { z } from "zod";
import { getUserId } from "@/lib/api";
import { getAuthSeed } from "@/lib/auth";
import { recordPersistedFunnelEvent } from "@/lib/funnel-events-server";
import { jsonError, jsonOk } from "@/lib/runtime";
import { createStripeCheckoutSession } from "@/lib/stripe-server";

const bodySchema = z
  .object({
    returnTo: z.string().max(500).optional().nullable(),
    visitorId: z.string().max(160).optional().nullable(),
    resumeEmailDeliveryId: z.string().max(200).optional().nullable(),
    resumeEmailCampaignKey: z.enum(BILLING_CHECKOUT_REMINDER_KEYS).optional().nullable(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid billing checkout payload", 400, {
        issues: parsed.error.issues,
      });
    }

    const seed = await getAuthSeed(req);
    const userId = seed?.userId ?? getUserId(req);
    if (!userId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }

    const { profile, session } = await createStripeCheckoutSession({
      userId,
      name: seed?.name,
      email: seed?.email ?? null,
      avatarUrl: seed?.avatarUrl ?? null,
      handleBase: seed?.handleBase,
      returnTo: parsed.data?.returnTo ?? "/dashboard",
      resumeEmailDeliveryId: parsed.data?.resumeEmailDeliveryId ?? null,
      resumeEmailCampaignKey: parsed.data?.resumeEmailCampaignKey ?? null,
    });

    await recordPersistedFunnelEvent({
      eventKey: "billing_checkout_started",
      eventId: session.id,
      occurredAt: new Date().toISOString(),
      visitorId: parsed.data?.visitorId ?? null,
      authUserId: seed?.userId ?? null,
      learnerProfileId: profile.id,
      funnel: "acquisition_activation",
      path: "/dashboard",
      pageUrl: null,
      utmSource: profile.acquisition?.last?.utmSource ?? profile.acquisition?.first?.utmSource ?? null,
      utmMedium: profile.acquisition?.last?.utmMedium ?? profile.acquisition?.first?.utmMedium ?? null,
      utmCampaign: profile.acquisition?.last?.utmCampaign ?? profile.acquisition?.first?.utmCampaign ?? null,
      utmContent: profile.acquisition?.last?.utmContent ?? profile.acquisition?.first?.utmContent ?? null,
      utmTerm: profile.acquisition?.last?.utmTerm ?? profile.acquisition?.first?.utmTerm ?? null,
      firstUtmSource: profile.acquisition?.first?.utmSource ?? null,
      firstUtmMedium: profile.acquisition?.first?.utmMedium ?? null,
      firstUtmCampaign: profile.acquisition?.first?.utmCampaign ?? null,
      firstUtmContent: profile.acquisition?.first?.utmContent ?? null,
      firstUtmTerm: profile.acquisition?.first?.utmTerm ?? null,
      landingPath: profile.acquisition?.last?.landingPath ?? profile.acquisition?.first?.landingPath ?? null,
      firstLandingPath: profile.acquisition?.first?.landingPath ?? null,
      referrer: profile.acquisition?.last?.referrer ?? profile.acquisition?.first?.referrer ?? null,
      firstReferrer: profile.acquisition?.first?.referrer ?? null,
      paidSource: null,
      properties: {
        checkout_session_id: session.id,
        return_to: parsed.data?.returnTo ?? "/dashboard",
        reminder_campaign: parsed.data?.resumeEmailCampaignKey ?? null,
      },
    });

    return jsonOk({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    return jsonError("BILLING_CHECKOUT_FAILED", "Unable to start billing checkout", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
