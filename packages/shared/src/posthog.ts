type PosthogCaptureResult = {
  ok: boolean;
  status?: number;
  detail?: string | null;
  reason?: string;
};

function cleanText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeHost(input: string | null | undefined) {
  const value = cleanText(input) ?? "https://us.i.posthog.com";
  return value.replace(/\/+$/, "");
}

export async function capturePosthogServerEvent(input: {
  apiKey: string | null | undefined;
  host?: string | null | undefined;
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  timestamp?: string | null | undefined;
}): Promise<PosthogCaptureResult> {
  const apiKey = cleanText(input.apiKey);
  const distinctId = cleanText(input.distinctId);
  const event = cleanText(input.event);
  if (!apiKey || !distinctId || !event) {
    return { ok: false, reason: "MISSING_CONFIG" };
  }

  const payload = {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties: {
      distinct_id: distinctId,
      ...(input.properties ?? {}),
    },
    timestamp: cleanText(input.timestamp ?? null) ?? undefined,
  };

  try {
    const response = await fetch(`${normalizeHost(input.host)}/capture/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: (await response.text().catch(() => "")).slice(0, 200) || null,
        reason: "POSTHOG_CAPTURE_FAILED",
      };
    }

    return {
      ok: true,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "POSTHOG_CAPTURE_REQUEST_FAILED",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
