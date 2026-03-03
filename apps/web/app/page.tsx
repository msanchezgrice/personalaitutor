import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { getAuthSeed } from "@/lib/auth";
import { runtimeGetDashboardSummary } from "@/lib/runtime";
import { BRAND_NAME } from "@/lib/site";

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
    url: "/",
    images: [{ url: "/assets/social_media_banner.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | Learn Fast and Prove It Publicly`,
    description:
      "Build AI workflows, verify your skills, and generate a public profile employers can trust.",
    images: ["/assets/social_media_banner.png"],
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
    });
    if (summary?.user?.handle) {
      replacements['href="/sign-in?redirect_url=/dashboard/" class="btn btn-secondary">Log In</a>'] =
        'href="/dashboard/?welcome=1" class="btn btn-secondary">Dashboard</a>';
    }
  }
  return <GeminiStaticPage template="index.html" replacements={replacements} />;
}
