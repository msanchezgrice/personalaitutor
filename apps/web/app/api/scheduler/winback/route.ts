import { NextRequest } from "next/server";
import { jsonOk } from "@aitutor/shared";
import { requireCronSecret } from "@/lib/cron-auth";
import { sendWinbacksDue } from "@/lib/winback";

export const maxDuration = 300;

/**
 * Inactivity winback sweep (rebuild Phase 3.5/3.6). Vercel cron sends GET;
 * POST stays for manual triggering. Both are guarded by CRON_SECRET.
 * Idempotent per learner per winback stage — safe to re-run daily.
 */
async function runSweep() {
  const result = await sendWinbacksDue();
  return jsonOk({
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    sentKeysByUser: result.sentKeysByUser,
  });
}

export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;
  return runSweep();
}

export async function POST(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;
  return runSweep();
}
