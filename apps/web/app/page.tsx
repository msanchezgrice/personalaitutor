import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { getAuthSeed } from "@/lib/auth";
import { getFeaturedLearnArticles } from "@/lib/learn-content";
import { runtimeGetDashboardSummary } from "@/lib/runtime";
import {
  BRAND_NAME,
  BRAND_LINKEDIN_URL,
  BRAND_X_HANDLE,
  BRAND_X_URL,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/site";

const appBaseUrl = getSiteUrl();
const ogImageUrl = `${appBaseUrl}${DEFAULT_OG_IMAGE_PATH}`;
const featuredLearnArticles = getFeaturedLearnArticles(3);
const homeFaqs = [
  {
    question: "What does AI upskilling actually mean?",
    answer:
      "AI upskilling means learning how to use AI tools to improve real work outputs, decisions, and workflows. The fastest path is role-specific, project-based, and tied to visible proof.",
  },
  {
    question: "Do I need to know how to code to build AI skills?",
    answer:
      "No. Coding expands what you can build, but strong AI projects also exist in operations, marketing, product, sales, support, and design. What matters is structured workflow thinking and proof of execution.",
  },
  {
    question: "What should I build first if I want an AI portfolio?",
    answer:
      "Start with one narrow workflow that saves time or improves quality in your current role. Then document the workflow, artifact, tool stack, and result as a portfolio entry.",
  },
  {
    question: "How do I prove AI skills to employers?",
    answer:
      "Use projects, artifacts, build logs, before-and-after results, and public portfolio pages. Employers trust evidence they can inspect more than generic claims or tool lists.",
  },
];

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHomeLearningSection() {
  const guideCards = featuredLearnArticles
    .map((article) => `
      <a href="/learn/${article.slug}" class="glass group rounded-3xl border border-white/10 bg-black/20 p-6 transition hover:border-emerald-500/40 hover:bg-white/5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">${escapeHtml(article.category)}</span>
          <span class="text-xs text-gray-500">${escapeHtml(article.readingTime)}</span>
        </div>
        <h3 class="mb-3 text-2xl font-[Outfit] text-white transition group-hover:text-emerald-400">${escapeHtml(article.title)}</h3>
        <p class="mb-5 text-sm leading-7 text-gray-300">${escapeHtml(article.description)}</p>
        <div class="mb-5 flex flex-wrap gap-2">
          ${article.keywords.slice(0, 3).map((keyword) => `<span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">${escapeHtml(keyword)}</span>`).join("")}
        </div>
        <div class="inline-flex items-center gap-2 text-sm font-medium text-emerald-400">Read guide <span aria-hidden="true">→</span></div>
      </a>
    `)
    .join("");

  const faqCards = homeFaqs
    .map((entry) => `
      <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h3 class="mb-3 text-xl font-[Outfit] text-white">${escapeHtml(entry.question)}</h3>
        <p class="text-sm leading-7 text-gray-300">${escapeHtml(entry.answer)}</p>
      </div>
    `)
    .join("");

  return `
  <section class="py-24 relative border-t border-white/5 bg-black/20">
    <div class="container">
      <div class="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div class="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">AI Learning Guides</div>
          <h2 class="text-4xl font-[Outfit] text-white">Start with the AI upskilling content people actually search for.</h2>
        </div>
        <p class="max-w-2xl text-sm leading-7 text-gray-300">
          These guides cover the exact topics that convert curiosity into career leverage: how to build AI skills, how to package projects into an AI portfolio, and how to prove the work to employers.
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        ${guideCards}
      </div>

      <div class="mt-10 flex justify-center">
        <a href="/learn" class="btn btn-secondary px-8 py-4">Browse All Guides</a>
      </div>
    </div>
  </section>

  <section class="py-24 border-t border-white/5 bg-black/30">
    <div class="container">
      <div class="mb-10 max-w-3xl">
        <div class="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">FAQ</div>
        <h2 class="text-4xl font-[Outfit] text-white">Common questions about AI skills, AI portfolios, and career proof</h2>
      </div>
      <div class="grid gap-6 lg:grid-cols-2">
        ${faqCards}
      </div>
    </div>
  </section>
  `;
}

const homeLearningSectionHtml = buildHomeLearningSection();
const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND_NAME,
  url: appBaseUrl,
  logo: `${appBaseUrl}/assets/branding/brand_brain_icon.svg`,
  sameAs: [BRAND_X_URL, BRAND_LINKEDIN_URL],
};
const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: BRAND_NAME,
  url: appBaseUrl,
};
const homeFaqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaqs.map((entry) => ({
    "@type": "Question",
    name: entry.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: entry.answer,
    },
  })),
};

export const metadata: Metadata = {
  title: `AI Upskilling for Working Professionals | ${BRAND_NAME}`,
  description:
    "AI upskilling for working professionals. Build AI workflows, verify your skills, and publish public proof employers can trust.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `AI Upskilling for Working Professionals | ${BRAND_NAME}`,
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
    title: `AI Upskilling for Working Professionals | ${BRAND_NAME}`,
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
  const authFirstHref = "/sign-up?redirect_url=/onboarding/";
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
    `href="${authFirstHref}" class="btn btn-primary animate-pulse-glow">Start Assessment <i class="fa-solid fa-arrow-right ml-2 text-sm"></i></a>`;
  replacements['href="/assessment/" class="btn btn-primary text-lg px-8 py-4">Take the AI Assessment</a>'] =
    `href="${authFirstHref}" class="btn btn-primary text-lg px-8 py-4">Take the AI Assessment</a>`;
  replacements['href="/assessment/" class="btn btn-primary text-xl px-10 py-5 animate-pulse-glow shadow-2xl">Start Your AI'] =
    `href="${authFirstHref}" class="btn btn-primary text-xl px-10 py-5 animate-pulse-glow shadow-2xl">Start Your AI`;
  replacements['href="/assessment" class="btn btn-primary animate-pulse-glow">Start Assessment <i class="fa-solid fa-arrow-right ml-2 text-sm"></i></a>'] =
    `href="${authFirstHref}" class="btn btn-primary animate-pulse-glow">Start Assessment <i class="fa-solid fa-arrow-right ml-2 text-sm"></i></a>`;
  replacements['href="/assessment" class="btn btn-primary text-lg px-8 py-4">Take the AI Assessment</a>'] =
    `href="${authFirstHref}" class="btn btn-primary text-lg px-8 py-4">Take the AI Assessment</a>`;
  replacements['href="/assessment/"'] = `href="${authFirstHref}"`;
  replacements['href="/assessment"'] = `href="${authFirstHref}"`;
  replacements['<a href="#public-proof" class="nav-link">Public Proof</a>'] =
    '<a href="#public-proof" class="nav-link">Public Proof</a><a href="/learn" class="nav-link">Learning</a>';
  replacements["<!-- CTA -->"] = `${homeLearningSectionHtml}\n\n  <!-- CTA -->`;
  replacements['<img src="/assets/branding/brand_wordmark_logo.png" alt="My AI Skill Tutor" class="h-8 w-auto object-contain" />'] =
    '<img src="/assets/branding/brand_brain_icon.svg" alt="My AI Skill Tutor" class="h-11 w-11 object-contain" /><span class="font-[Outfit] font-bold text-[1.9rem] leading-none tracking-tight text-[var(--text-main)]">My AI Skill Tutor</span>';
  return (
    <>
      <GeminiStaticPage template="index.html" replacements={replacements} runtime="none" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqLd) }} />
    </>
  );
}
