import { NextRequest, NextResponse } from "next/server";

type ClerkApiError = {
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};

type ClerkProbeResult = {
  status: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  endpoint: string | null;
  networkError: string | null;
};

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function decodeBase64Url(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function normalizeHost(raw: string) {
  return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
}

function decodeFrontendApiFromPublishableKey(publishableKey: string) {
  const trimmed = publishableKey.trim();
  const isRecognized = trimmed.startsWith("pk_test_") || trimmed.startsWith("pk_live_");
  if (!isRecognized) return null;

  const parts = trimmed.split("_");
  if (parts.length < 3) return null;

  const encodedPayload = parts.slice(2).join("_");
  try {
    const decoded = decodeBase64Url(encodedPayload);
    const frontendApi = decoded.split("$")[0]?.trim();
    if (!frontendApi) return null;
    return normalizeHost(frontendApi);
  } catch {
    return null;
  }
}

function publishableKeyMode(publishableKey: string | undefined) {
  if (!publishableKey) return "missing";
  if (publishableKey.startsWith("pk_test_")) return "test";
  if (publishableKey.startsWith("pk_live_")) return "live";
  return "unknown";
}

function secretKeyMode(secretKey: string | undefined) {
  if (!secretKey) return "missing";
  if (secretKey.startsWith("sk_test_")) return "test";
  if (secretKey.startsWith("sk_live_")) return "live";
  return "unknown";
}

function hostnameFromOrigin(origin: string) {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

function resolveRequestOrigin(req: NextRequest) {
  const explicitOrigin = req.headers.get("origin")?.trim();
  if (explicitOrigin) return explicitOrigin;

  const forwardedHost = req.headers.get("x-forwarded-host")?.trim();
  const host = forwardedHost || req.headers.get("host")?.trim();
  if (!host) return "http://localhost:6396";

  const proto = req.headers.get("x-forwarded-proto")?.trim() || "http";
  return `${proto}://${host}`;
}

async function probeClerkClient(frontendApiHost: string, appOrigin: string): Promise<ClerkProbeResult> {
  const endpoint = new URL("/v1/client", `https://${frontendApiHost}`);
  endpoint.searchParams.set("__clerk_api_version", "2025-04-10");
  endpoint.searchParams.set("_clerk_js_version", "5.0.0");
  endpoint.searchParams.set("_is_native", "0");

  try {
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        origin: appOrigin,
        referer: `${appOrigin}/sign-in`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as ClerkApiError | null;
    const firstError = payload?.errors?.[0];

    return {
      status: response.status,
      errorCode: firstError?.code ?? null,
      errorMessage: firstError?.message ?? null,
      endpoint: endpoint.toString(),
      networkError: null,
    };
  } catch (error) {
    return {
      status: null,
      errorCode: null,
      errorMessage: null,
      endpoint: endpoint.toString(),
      networkError: error instanceof Error ? error.message : "UNKNOWN",
    };
  }
}

export async function GET(req: NextRequest) {
  const requestHost = req.nextUrl.hostname;
  if (process.env.NODE_ENV === "production" || !isLocalHost(requestHost)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "DIAGNOSTICS_FORBIDDEN",
          message: "This endpoint is only available on localhost in non-production mode.",
        },
      },
      {
        status: 403,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  const frontendApiFromEnv = process.env.NEXT_PUBLIC_CLERK_FRONTEND_API?.trim() || process.env.CLERK_FRONTEND_API?.trim();
  const frontendApiFromKey = publishableKey ? decodeFrontendApiFromPublishableKey(publishableKey) : null;
  const frontendApiHost = frontendApiFromEnv ? normalizeHost(frontendApiFromEnv) : frontendApiFromKey;
  const appOrigin = resolveRequestOrigin(req);
  const appHostname = hostnameFromOrigin(appOrigin);
  const appOriginMode = isLocalHost(appHostname) ? "local" : "non-local";

  const diagnostics: {
    appOrigin: string;
    appOriginMode: string;
    publishableKeyMode: string;
    secretKeyMode: string;
    frontendApiHost: string | null;
    clientStatus: number | null;
    clientErrorCode: string | null;
    clientErrorMessage: string | null;
    clientEndpoint: string | null;
    clientNetworkError: string | null;
    hints: string[];
  } = {
    appOrigin,
    appOriginMode,
    publishableKeyMode: publishableKeyMode(publishableKey),
    secretKeyMode: secretKeyMode(secretKey),
    frontendApiHost: frontendApiHost ?? null,
    clientStatus: null,
    clientErrorCode: null,
    clientErrorMessage: null,
    clientEndpoint: null,
    clientNetworkError: null,
    hints: [],
  };

  if (!publishableKey) {
    diagnostics.hints.push("Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/web/.env.local.");
  }
  if (!secretKey) {
    diagnostics.hints.push("Set CLERK_SECRET_KEY in apps/web/.env.local.");
  }

  if (!frontendApiHost) {
    diagnostics.hints.push("Unable to derive Clerk frontend API host from publishable key. Check your Clerk key format.");
  }

  if (diagnostics.publishableKeyMode === "live") {
    diagnostics.hints.push("Local development should use a pk_test publishable key and matching sk_test secret key.");
  }
  if (
    diagnostics.publishableKeyMode !== "missing" &&
    diagnostics.secretKeyMode !== "missing" &&
    diagnostics.publishableKeyMode !== diagnostics.secretKeyMode
  ) {
    diagnostics.hints.push("Publishable and secret keys are in different modes. Keep both test or both live.");
  }
  if (appHostname === "127.0.0.1") {
    diagnostics.hints.push("Use http://localhost:6396 for local auth and add that exact origin/redirect in Clerk.");
  }
  if (frontendApiFromEnv && frontendApiFromKey && normalizeHost(frontendApiFromEnv) !== frontendApiFromKey) {
    diagnostics.hints.push("NEXT_PUBLIC_CLERK_FRONTEND_API does not match the host encoded in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.");
  }

  if (frontendApiHost) {
    const probe = await probeClerkClient(frontendApiHost, appOrigin);
    diagnostics.clientStatus = probe.status;
    diagnostics.clientErrorCode = probe.errorCode;
    diagnostics.clientErrorMessage = probe.errorMessage;
    diagnostics.clientEndpoint = probe.endpoint;
    diagnostics.clientNetworkError = probe.networkError;

    if (probe.errorCode === "origin_invalid") {
      diagnostics.hints.push(`Add ${appOrigin} to Clerk Allowed Origins and allowed redirect URLs in the same Clerk instance as your keys.`);
    }
    if (probe.status === 401 || probe.status === 403) {
      diagnostics.hints.push("Verify publishable key and Clerk domain belong to the same Clerk instance.");
    }
    if (probe.networkError) {
      diagnostics.hints.push("Unable to reach Clerk frontend API. Verify network access and frontend API hostname.");
    }
  }

  return NextResponse.json(
    {
      ok: true,
      diagnostics,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
