import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get("redirect") === "1";
  const redirectUrl = `${req.nextUrl.origin}${redirect ? "/dashboard/?oauth=google_connected" : "/"}`;
  const signInUrl = new URL("/sign-in", req.nextUrl.origin);
  signInUrl.searchParams.set("redirect_url", redirectUrl);
  return NextResponse.redirect(signInUrl);
}
