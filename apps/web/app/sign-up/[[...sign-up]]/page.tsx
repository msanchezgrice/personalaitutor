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
    <main className="min-h-screen bg-[#eef3f2] text-[#0f172a] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-6 sm:gap-10 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[minmax(0,1fr),auto]">
        <section className="max-w-xl space-y-4 sm:space-y-6">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm sm:px-4 sm:py-2 sm:text-xs">
            AI-readiness score
          </span>
          <div className="space-y-3 sm:space-y-4">
            <h1 className="font-[Outfit] text-3xl font-semibold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl">
              <span className="sm:hidden">Your score is saved. Now raise it.</span>
              <span className="hidden sm:inline">Your score is saved. Create your account to start raising it.</span>
            </h1>
            <p className="max-w-lg text-sm leading-6 text-slate-600 sm:text-lg sm:leading-7">
              Tutor sessions that close one skill gap per week, real proof artifacts you can show, and your score
              trend over time — all attached to one profile.
            </p>
          </div>
          <div className="space-y-2 text-sm text-slate-700 sm:hidden">
            <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
              <span className="font-semibold text-slate-900">Tutor sessions:</span> Work each module step-by-step and close your top gaps.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
              <span className="font-semibold text-slate-900">Proof artifacts:</span> Turn every session into work you can actually show.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
              <span className="font-semibold text-slate-900">Score trend:</span> Watch your AI-readiness score move as you ship.
            </div>
          </div>
          <div className="hidden gap-3 text-sm text-slate-700 sm:grid sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tutor sessions</div>
              <div className="mt-2 font-medium text-slate-900">Work each module step-by-step and close your top gaps.</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Proof artifacts</div>
              <div className="mt-2 font-medium text-slate-900">Turn every session into work you can actually show.</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Score trend</div>
              <div className="mt-2 font-medium text-slate-900">Watch your AI-readiness score move as you ship.</div>
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
