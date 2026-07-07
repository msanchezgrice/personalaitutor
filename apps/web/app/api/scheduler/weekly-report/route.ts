import { NextRequest } from "next/server";
import { jsonOk } from "@aitutor/shared";
import { requireCronSecret } from "@/lib/cron-auth";
import { sendWeeklyReportsDue } from "@/lib/weekly-report";

export const maxDuration = 300;

/**
 * Weekly proof-of-watch email sweep (rebuild Phase 3.4/3.6). Vercel cron
 * sends GET; POST stays for manual triggering. Both are guarded by
 * CRON_SECRET. Idempotent per learner per ISO week — safe to re-run.
 */
async function runSweep() {
  const result = await sendWeeklyReportsDue();
  return jsonOk({
    campaignKey: result.campaignKey,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
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
