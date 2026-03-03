import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/employers(.*)",
  "/u/(.*)",
  "/api/og/(.*)",
  "/api/employers/talent(.*)",
  "/robots.txt",
  "/sitemap.xml",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (!isPublicRoute(req)) {
    await auth.protect();
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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ico|woff2?|ttf|map|txt|xml)).*)",
    "/(api|trpc)(.*)",
  ],
};
