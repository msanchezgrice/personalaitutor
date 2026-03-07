import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { experimental__simple as clerkSimple } from "@clerk/themes";
import { BRAND_NAME, getSiteUrl } from "@/lib/site";
import { AuthPageTracking } from "@/components/auth-page-tracking";
import { AuthWidgetFallback } from "@/components/auth-widget-fallback";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Sign Up`,
  robots: {
    index: false,
    follow: false,
  },
};

function safeRedirect(input?: string) {
  if (!input || typeof input !== "string") return "/onboarding/";
  if (input.startsWith("/")) return input;
  try {
    const url = new URL(input);
    const site = new URL(getSiteUrl());
    if (url.origin !== site.origin) return "/onboarding/";
    return `${url.pathname}${url.search}` || "/onboarding/";
  } catch {
    return "/onboarding/";
  }
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const forceRedirectUrl = safeRedirect(params?.redirect_url);

  return (
    <main className="min-h-screen bg-[#eef3f2] text-[#0f172a] flex items-center justify-center px-6 py-10">
      <div className="w-full flex flex-col items-center">
        <SignUp
          routing="path"
          path="/sign-up"
          forceRedirectUrl={forceRedirectUrl}
          fallbackRedirectUrl="/onboarding/"
          appearance={{
            baseTheme: clerkSimple,
            variables: {
              colorPrimary: "#10b981",
              colorBackground: "#f8fafc",
              colorInputBackground: "#ffffff",
              colorText: "#0f172a",
              colorTextSecondary: "#475569",
            },
          }}
        />
        <AuthPageTracking mode="sign-up" />
        <AuthWidgetFallback mode="sign-up" />
      </div>
    </main>
  );
}
