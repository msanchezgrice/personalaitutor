function withNoStoreHeaders(init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store, max-age=0, must-revalidate");
  }
  if (!headers.has("pragma")) {
    headers.set("pragma", "no-cache");
  }
  if (!headers.has("expires")) {
    headers.set("expires", "0");
  }
  return headers;
}

export function jsonOk(data: unknown, init?: ResponseInit): Response {
  return Response.json({ ok: true, ...((data as Record<string, unknown>) ?? {}) }, { ...init, headers: withNoStoreHeaders(init) });
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>,
): Response {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ?? {}),
      },
    },
    { status, headers: withNoStoreHeaders() },
  );
}
