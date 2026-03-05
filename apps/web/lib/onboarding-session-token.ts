import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

type SessionTokenPayload = {
  v: typeof TOKEN_VERSION;
  sessionId: string;
  userId: string;
  iat: number;
  exp: number;
};

function tokenSecret() {
  const explicit = process.env.ONBOARDING_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const fallback =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (fallback) return fallback;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ONBOARDING_SESSION_SECRET_MISSING");
  }
  return "dev-onboarding-session-secret";
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signPayload(payloadEncoded: string) {
  return createHmac("sha256", tokenSecret()).update(payloadEncoded).digest("base64url");
}

export function issueOnboardingSessionToken(input: {
  sessionId: string;
  userId: string;
  ttlMs?: number;
}) {
  const now = Date.now();
  const payload: SessionTokenPayload = {
    v: TOKEN_VERSION,
    sessionId: input.sessionId,
    userId: input.userId,
    iat: now,
    exp: now + Math.max(60_000, input.ttlMs ?? DEFAULT_TTL_MS),
  };
  const payloadEncoded = base64UrlJson(payload);
  const signature = signPayload(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

export function verifyOnboardingSessionToken(
  token: string | null | undefined,
  expected?: { sessionId?: string; userId?: string },
) {
  if (!token || !token.trim()) return null;
  const [payloadEncoded, providedSig] = token.trim().split(".");
  if (!payloadEncoded || !providedSig) return null;

  const expectedSig = signPayload(payloadEncoded);
  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, "base64url").toString("utf8")) as SessionTokenPayload;
    if (!payload || payload.v !== TOKEN_VERSION) return null;
    if (!payload.sessionId || !payload.userId) return null;
    if (Date.now() > Number(payload.exp)) return null;
    if (expected?.sessionId && payload.sessionId !== expected.sessionId) return null;
    if (expected?.userId && payload.userId !== expected.userId) return null;
    return payload;
  } catch {
    return null;
  }
}
