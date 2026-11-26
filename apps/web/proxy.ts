import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/sign-out(.*)",
  "/onboarding(.*)",
  "/assessment(.*)",
  "/architecture(.*)",
  "/chat-onboarding-prototype(.*)",
  "/employers(.*)",
  "/learn(.*)",
  "/tools/career-remapping",
  // Career Map + Proof Studio public surfaces (2026-11-25). Route handlers
  // under /api/career-map and /api/voice-models/public enforce their own
  // limits; anything owner-only checks auth inside the handler.
  "/map(.*)",
  "/remapped(.*)",
  "/video/(.*)",
  "/api/career-map(.*)",
  "/api/voice-models/public/(.*)",
  // Agent-facing static files: the matcher does not skip .txt/.md/.json, so
  // they must be listed or signed-out agents get redirected to sign-in.
  "/llms.txt",
  "/agents.md",
  "/.well-known/(.*)",
  "/downloads/career-remapping-workbook.pdf",
  "/learning(.*)",
  "/generated/(.*)",
  "/u/(.*)",
  "/api/auth/google/start(.*)",
  "/api/auth/clerk/diagnostics(.*)",
  "/api/auth/linkedin/start(.*)",
  "/api/auth/linkedin/callback(.*)",
  "/api/auth/x/start(.*)",
  "/api/auth/x/callback(.*)",
  "/api/onboarding/start(.*)",
  "/api/onboarding/draft(.*)",
  "/api/onboarding/complete(.*)",
  "/api/onboarding/resume-upload(.*)",
  "/api/onboarding/career-import(.*)",
  "/api/onboarding/situation(.*)",
  "/api/assessment/start(.*)",
  "/api/assessment/anonymous/(.*)",
  "/api/analytics/conversion(.*)",
  "/api/analytics/funnel(.*)",
  "/api/email/resend/webhook(.*)",
  "/api/billing/webhook(.*)",
  // Vercel cron invocations carry no Clerk session; the route handlers
  // themselves enforce CRON_SECRET (see lib/cron-auth.ts).
  "/api/scheduler/(.*)",
  "/api/og/(.*)",
  "/api/employers/talent(.*)",
  "/robots.txt",
  "/sitemap.xml",
]);
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  // x-user-id is set by this proxy only. Drop any client-supplied value so a
  // signed-out caller on a public route cannot impersonate another user
  // (route handlers fall back to this header via getUserId/getAuthUserId).
  requestHeaders.delete("x-user-id");

  if (!isPublicRoute(req) && !userId) {
    if (isApiRoute(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in required",
          },
        },
        { status: 401 },
      );
    }

    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  if (!userId) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  requestHeaders.set("x-user-id", userId);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
