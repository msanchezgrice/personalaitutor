/** A bounded, single-use approval gate. This is not a general-purpose mail endpoint. */
const RUN = "tutor-20261028p-b96d3a2f4c7e41be";
const EXPIRES_AT = Date.parse("2026-10-29T20:00:00Z");
const TEXT = "This is a one-time test of the AI Tutor worker email configuration.";
type Send = (input: { to: string; subject: string; html: string; text: string; idempotencyKey?: string }) => Promise<{ ok: boolean; messageId?: string | null }>;

type MailResult = "disabled" | "expired" | "sender_mismatch" | "accepted_without_id" | "failed" | { acceptedId: string };

export function createOwnedMailCheck() {
 let attempted = false;
 return async function runOwnedMailCheck(flag: string | undefined, now: number, from: string, send: Send): Promise<MailResult> {
  if (flag !== RUN) return "disabled";
  if (!Number.isFinite(now) || now >= EXPIRES_AT) return "expired";
  if (from !== "AI Tutor <onboarding@resend.dev>") return "sender_mismatch";
  if (attempted) return "disabled";
  attempted = true;
  const result = await send({
    to: "msanchezgrice@gmail.com",
    subject: "AI Tutor security verification 2026-10-28p",
    html: `<p>${TEXT}</p>`,
    text: TEXT,
    idempotencyKey: RUN,
  });
  if (!result.ok) return "failed";
  const id = result.messageId;
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? { acceptedId: id } : "accepted_without_id";
 };
}

export function attestationMessage(version: string, key: string | undefined): string {
  return `[worker] attestation release=tutor-20261028p node=${version} resendKeyPresent=${Boolean(key?.trim())}`;
}

export function logOwnedMailResult(result: MailResult, log: (message: string) => void): void {
  if (typeof result === "object") {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.acceptedId)) log(`[worker] owned-mail-check result=accepted messageId=${result.acceptedId}`);
    else log("[worker] owned-mail-check result=accepted_without_id");
  } else if (result !== "disabled") log(`[worker] owned-mail-check result=${result}`);
}
