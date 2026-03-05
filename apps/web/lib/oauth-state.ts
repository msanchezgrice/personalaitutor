import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type OAuthProvider = "linkedin" | "x";

const OAUTH_STATE_VERSION = "v1";
const DEFAULT_TTL_MS = 10 * 60 * 1000;

type OAuthStateEnvelope<TData extends Record<string, unknown>> = {
  v: typeof OAUTH_STATE_VERSION;
  provider: OAuthProvider;
  nonce: string;
  iat: number;
  exp: number;
  data: TData;
};

function oauthStateSecret() {
  const explicit = process.env.OAUTH_STATE_SECRET?.trim();
  if (explicit) return explicit;
  const clerkSecret = process.env.CLERK_SECRET_KEY?.trim();
  if (clerkSecret) return clerkSecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("OAUTH_STATE_SECRET_MISSING");
  }
  return "dev-oauth-state-secret";
}

function encodeJsonBase64url(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signEncodedPayload(payloadEncoded: string) {
  return createHmac("sha256", oauthStateSecret()).update(payloadEncoded).digest("base64url");
}

export function issueOAuthStateToken<TData extends Record<string, unknown>>(input: {
  provider: OAuthProvider;
  data: TData;
  ttlMs?: number;
}) {
  const now = Date.now();
  const envelope: OAuthStateEnvelope<TData> = {
    v: OAUTH_STATE_VERSION,
    provider: input.provider,
    nonce: randomBytes(16).toString("base64url"),
    iat: now,
    exp: now + Math.max(30_000, input.ttlMs ?? DEFAULT_TTL_MS),
    data: input.data,
  };
  const encoded = encodeJsonBase64url(envelope);
  const signature = signEncodedPayload(encoded);
  return `${encoded}.${signature}`;
}

export function verifyOAuthStateToken<TData extends Record<string, unknown>>(
  token: string | null | undefined,
  provider: OAuthProvider,
) {
  if (!token || !token.trim()) return null;
  const [encoded, providedSig] = token.trim().split(".");
  if (!encoded || !providedSig) return null;

  const expectedSig = signEncodedPayload(encoded);
  const expected = Buffer.from(expectedSig, "utf8");
  const provided = Buffer.from(providedSig, "utf8");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStateEnvelope<TData>;
    if (!parsed || parsed.v !== OAUTH_STATE_VERSION) return null;
    if (parsed.provider !== provider) return null;
    if (!parsed.nonce || typeof parsed.nonce !== "string") return null;
    if (Date.now() > Number(parsed.exp)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createPkceVerifier() {
  // RFC 7636: verifier must be 43-128 chars from [A-Z / a-z / 0-9 / "-" / "." / "_" / "~"].
  return randomBytes(64).toString("base64url").slice(0, 96);
}

export function pkceChallengeS256(verifier: string) {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

