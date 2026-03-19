import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/runtime";
import { constructStripeWebhookEvent, handleStripeWebhookEvent } from "@/lib/stripe-server";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature")?.trim();
  if (!signature) {
    return jsonError("STRIPE_SIGNATURE_MISSING", "Stripe signature is required", 400);
  }

  const body = await req.text();

  try {
    const event = constructStripeWebhookEvent(body, signature);
    const subscription = await handleStripeWebhookEvent(event);
    return jsonOk({
      received: true,
      eventId: event.id,
      eventType: event.type,
      syncedStatus: subscription?.status ?? null,
    });
  } catch (error) {
    return jsonError("STRIPE_WEBHOOK_INVALID", "Stripe webhook verification failed", 400, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
