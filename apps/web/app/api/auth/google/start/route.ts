import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@aitutor/shared";

function decodeClerkFrontendHost() {
  const key = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return null;
  const encoded = key.split("_").pop();
  if (!encoded) return null;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8").replace(/\$/g, "").trim();
    if (!decoded) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const frontendHost = decodeClerkFrontendHost();
  if (!frontendHost) {
    return jsonError("GOOGLE_OAUTH_CONFIG_MISSING", "Google OAuth requires Clerk publishable key configuration", 503, {
      missing: ["CLERK_PUBLISHABLE_KEY"],
    });
  }

  const redirect = req.nextUrl.searchParams.get("redirect") === "1";
  const redirectUrl = `${req.nextUrl.origin}${redirect ? "/dashboard/?oauth=google_connected" : "/"}`;
  const signInUrl = new URL(`https://${frontendHost}/sign-in`);
  signInUrl.searchParams.set("redirect_url", redirectUrl);

  return NextResponse.redirect(signInUrl);
}

