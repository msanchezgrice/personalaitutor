export function jsonOk(data: unknown, init?: ResponseInit): Response {
  return Response.json({ ok: true, ...((data as Record<string, unknown>) ?? {}) }, init);
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
    { status },
  );
}
