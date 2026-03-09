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
    <main className="min-h-screen bg-[#eef3f2] text-[#0f172a] px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr),auto]">
        <section className="max-w-xl space-y-6">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
            Personalized assessment
          </span>
          <div className="space-y-4">
            <h1 className="font-[Outfit] text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Sign up to get your personalized AI assessment report sent to your inbox when complete.
            </h1>
            <p className="max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
              Create your account first so we can save your answers, email your results, and keep your progress tied to one profile.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Saved</div>
              <div className="mt-2 font-medium text-slate-900">Your assessment progress stays attached to your account.</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Delivered</div>
              <div className="mt-2 font-medium text-slate-900">Your finished report lands in your inbox when it is ready.</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Personalized</div>
              <div className="mt-2 font-medium text-slate-900">Your recommendations and next steps are tailored to you.</div>
            </div>
          </div>
        </section>

        <div className="flex flex-col items-center">
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
        </div>
        <AuthPageTracking mode="sign-up" />
        <AuthWidgetFallback mode="sign-up" />
      </div>
    </main>
  );
}
