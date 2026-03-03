import { NextRequest, NextResponse } from "next/server";

function safeRedirectTarget(input: string | null) {
  if (!input) return "/dashboard/?welcome=1";
  if (!input.startsWith("/")) return "/dashboard/?welcome=1";
  return input;
}

export async function GET(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get("redirect") === "1";
  const target = safeRedirectTarget(req.nextUrl.searchParams.get("target"));
  const redirectUrl = redirect ? target : "/";
  const signInUrl = new URL("/sign-in", req.nextUrl.origin);
  signInUrl.searchParams.set("redirect_url", redirectUrl);
  return NextResponse.redirect(signInUrl);
}
