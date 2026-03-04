import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { getAuthSeed } from "@/lib/auth";
import { runtimeGetDashboardSummary } from "@/lib/runtime";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/site";

const appBaseUrl = getSiteUrl();
const ogImageUrl = `${appBaseUrl}${DEFAULT_OG_IMAGE_PATH}`;

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Learn Fast and Prove It Publicly`,
  description:
    "Your dedicated AI copilot for career growth. Build AI workflows, complete modules, and publish public proof.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${BRAND_NAME} | Learn Fast and Prove It Publicly`,
    description:
      "Build AI workflows, verify your skills, and generate a public profile employers can trust.",
    url: appBaseUrl,
    images: [{
      url: ogImageUrl,
      width: DEFAULT_OG_IMAGE_WIDTH,
      height: DEFAULT_OG_IMAGE_HEIGHT,
      alt: DEFAULT_OG_IMAGE_ALT,
      type: "image/png",
    }],
  },
  twitter: {
    card: "summary_large_image",
    site: BRAND_X_HANDLE,
    creator: BRAND_X_HANDLE,
    title: `${BRAND_NAME} | Learn Fast and Prove It Publicly`,
    description:
      "Build AI workflows, verify your skills, and generate a public profile employers can trust.",
    images: [ogImageUrl],
  },
  other: {
    "og:image": ogImageUrl,
    "twitter:image": ogImageUrl,
  },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const replacements: Record<string, string> = {};
  const seed = await getAuthSeed();
  if (seed?.userId) {
    const summary = await runtimeGetDashboardSummary(seed.userId, {
      name: seed.name,
      handleBase: seed.handleBase,
      avatarUrl: seed.avatarUrl ?? null,
      email: seed.email ?? null,
    });
    if (summary?.user?.handle) {
      replacements['href="/sign-in?redirect_url=/dashboard/" class="btn btn-secondary">Log In</a>'] =
        'href="/dashboard/?welcome=1" class="btn btn-secondary">Dashboard</a>';
    }
  }
  replacements['href="/assessment/" class="btn btn-primary animate-pulse-glow">Start Assessment <i class="fa-solid fa-arrow-right ml-2 text-sm"></i></a>'] =
    'href="/onboarding/" class="btn btn-primary animate-pulse-glow">Start Assessment <i class="fa-solid fa-arrow-right ml-2 text-sm"></i></a>';
  replacements['href="/assessment/" class="btn btn-primary text-lg px-8 py-4">Take the AI Assessment</a>'] =
    'href="/onboarding/" class="btn btn-primary text-lg px-8 py-4">Take the AI Assessment</a>';
  replacements['href="/assessment/" class="btn btn-primary text-xl px-10 py-5 animate-pulse-glow shadow-2xl">Start Your AI'] =
    'href="/onboarding/" class="btn btn-primary text-xl px-10 py-5 animate-pulse-glow shadow-2xl">Start Your AI';
  replacements['href="/assessment" class="btn btn-primary animate-pulse-glow">Start Assessment <i class="fa-solid fa-arrow-right ml-2 text-sm"></i></a>'] =
    'href="/onboarding/" class="btn btn-primary animate-pulse-glow">Start Assessment <i class="fa-solid fa-arrow-right ml-2 text-sm"></i></a>';
  replacements['href="/assessment" class="btn btn-primary text-lg px-8 py-4">Take the AI Assessment</a>'] =
    'href="/onboarding/" class="btn btn-primary text-lg px-8 py-4">Take the AI Assessment</a>';
  replacements['href="/assessment/"'] = 'href="/onboarding/"';
  replacements['href="/assessment"'] = 'href="/onboarding/"';
  replacements['<img src="/assets/branding/brand_wordmark_logo.png" alt="My AI Skill Tutor" class="h-8 w-auto object-contain" />'] =
    '<img src="/assets/branding/brand_brain_icon.svg" alt="My AI Skill Tutor" class="h-11 w-11 object-contain" /><span class="font-[Outfit] font-bold text-[1.9rem] leading-none tracking-tight text-[var(--text-main)]">My AI Skill Tutor</span>';
  return <GeminiStaticPage template="index.html" replacements={replacements} />;
}
