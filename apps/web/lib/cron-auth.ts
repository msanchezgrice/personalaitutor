import "server-only";

import { NextRequest } from "next/server";
import { jsonError } from "@aitutor/shared";

/**
 * Cron authentication (rebuild Phase 3.6 — fixes the prod gap where no cron
 * config existed and scheduler routes were POST-only while Vercel cron sends
 * GET).
 *
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on cron
 * invocations when the CRON_SECRET env var is set on the project. A missing
 * CRON_SECRET fails closed (401), never open.
 */
export function requireCronSecret(req: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return jsonError("CRON_SECRET_MISSING", "CRON_SECRET is not configured", 401, {
      recoveryAction: "Set CRON_SECRET in the Vercel project env (all environments)",
    });
  }

  const header = req.headers.get("authorization")?.trim() ?? "";
  if (header !== `Bearer ${secret}`) {
    return jsonError("UNAUTHENTICATED", "Invalid cron credentials", 401);
  }

  return null;
}
