import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/runtime";
import { sendCareerMapEmail } from "@/lib/career-map/email";
import { CAREER_MAP_EMAIL_LOCKED, captureCareerMapEmail, findCareerMapByToken, markCareerMapEmailSent } from "@/lib/career-map/store";
import { readCareerMapCookieFromRequest } from "@/lib/career-map-linking";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One map is emailed at most once in this window, so the endpoint cannot be used to flood an inbox. */
const RESEND_WINDOW_MS = 10 * 60 * 1000;

const schema = z.object({
  email: z.string().trim().email().max(320),
});

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * POST `{ email }` -> `{ ok, captured: true, emailed, mapPath }`. Capture always counts; sending is best-effort.
 *
 * Only the browser that drew the map can save an email on it (the `mast_cm`
 * cookie must hold this map's token), and an address is set once. A map link
 * is meant to be shared; without these two rules anyone holding the link could
 * point the map at their own address, or use the endpoint to send mail.
 */
export async function POST(req: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Enter a valid email address", 400, { issues: parsed.error.issues });
    }

    const { token: rawToken } = await context.params;
    const token = safeDecode(rawToken ?? "");
    const existing = await findCareerMapByToken(token);
    if (!existing) {
      return jsonError("CAREER_MAP_NOT_FOUND", "We could not find that map", 404, {
        recoveryAction: "Check the link, or make a new map at /map.",
      });
    }

    if (readCareerMapCookieFromRequest(req) !== existing.token) {
      return jsonError("CAREER_MAP_NOT_OWNER", "This map can only be saved from the browser it was made in", 403, {
        recoveryAction: "Open the map on the device you made it on, or draw your own at /map.",
      });
    }

    let captured;
    try {
      captured = await captureCareerMapEmail({ token: existing.token, email: parsed.data.email });
    } catch (error) {
      if (error instanceof Error && error.message === CAREER_MAP_EMAIL_LOCKED) {
        return jsonError("CAREER_MAP_EMAIL_LOCKED", "This map is already saved", 409, {
          recoveryAction: "It was saved to another address or to an account. Draw a new map at /map to save it somewhere else.",
        });
      }
      throw error;
    }
    if (!captured?.email) {
      return jsonError("INVALID_BODY", "Enter a valid email address", 400, {
        recoveryAction: "Check the email address and retry.",
      });
    }

    const mapPath = `/map/${encodeURIComponent(captured.token)}`;
    let emailed = false;

    if (captured.status === "completed" && captured.map) {
      const sentAt = existing.mapEmailSentAt ? Date.parse(existing.mapEmailSentAt) : Number.NaN;
      const recentlySent = Number.isFinite(sentAt) && Date.now() - sentAt < RESEND_WINDOW_MS;
      if (recentlySent) {
        // Already on its way to this address; do not send a second copy.
        emailed = existing.email === captured.email;
      } else {
        try {
          emailed = await sendCareerMapEmail({ to: captured.email, map: captured.map, mapUrl: `${getSiteUrl()}${mapPath}` });
          if (emailed) await markCareerMapEmailSent(captured.id);
        } catch (error) {
          emailed = false;
          console.warn("[career-map-email] send failed", error instanceof Error ? error.message : "unknown");
        }
      }
    }

    return jsonOk({ captured: true, emailed, mapPath });
  } catch (error) {
    return jsonError("CAREER_MAP_EMAIL_FAILED", "We could not save your email right now", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
      recoveryAction: "Retry in a minute.",
    });
  }
}
