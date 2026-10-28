import { EMAIL_PRODUCT_NAME } from "@aitutor/shared";

export function lifecycleFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  return `${EMAIL_PRODUCT_NAME} <onboarding@resend.dev>`;
}

export async function sendResendEmail(input: { to: string; subject: string; html: string; text: string; idempotencyKey?: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false as const,
      errorCode: "RESEND_API_KEY_MISSING",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: lifecycleFromAddress(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false as const,
        errorCode: `RESEND_RESPONSE_${response.status}`,
        detail: detail.slice(0, 200),
      };
    }

    const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return {
      ok: true as const,
      messageId: typeof payload?.id === "string" && payload.id.trim() ? payload.id.trim() : null,
    };
  } catch (error) {
    return {
      ok: false as const,
      errorCode: "RESEND_REQUEST_FAILED",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
