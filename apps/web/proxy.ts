import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sign-out(.*)",
  "/onboarding(.*)",
  "/assessment(.*)",
  "/architecture(.*)",
  "/employers(.*)",
  "/generated/(.*)",
  "/u/(.*)",
  "/api/auth/google/start(.*)",
  "/api/auth/linkedin/start(.*)",
  "/api/auth/linkedin/callback(.*)",
  "/api/auth/x/start(.*)",
  "/api/auth/x/callback(.*)",
  "/api/onboarding/start(.*)",
  "/api/onboarding/complete(.*)",
  "/api/onboarding/resume-upload(.*)",
  "/api/onboarding/career-import(.*)",
  "/api/onboarding/situation(.*)",
  "/api/assessment/start(.*)",
  "/api/og/(.*)",
  "/api/employers/talent(.*)",
  "/robots.txt",
  "/sitemap.xml",
]);
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

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
    return NextResponse.next();
  }

  const headers = new Headers(req.headers);
  headers.set("x-user-id", userId);
  return NextResponse.next({
    request: {
      headers,
    },
  });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
