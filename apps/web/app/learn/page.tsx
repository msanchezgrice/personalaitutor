import type { Metadata } from "next";
import Link from "next/link";
import { LearningHeader } from "@/components/learning-header";
import { getLearnArticles } from "@/lib/learn-content";
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
const learnArticles = getLearnArticles();
const quickStartSlugs = [
  "ai-upskilling-roadmap",
  "how-to-build-an-ai-portfolio",
  "prove-ai-skills-to-employers",
];

export const metadata: Metadata = {
  title: `AI Upskilling Guides and Career Playbooks | ${BRAND_NAME}`,
  description:
    "Evergreen guides on AI upskilling, AI portfolios, proof-based project work, and how to turn AI skills into visible career leverage.",
  alternates: {
    canonical: "/learn",
  },
  openGraph: {
    title: `AI Upskilling Guides and Career Playbooks | ${BRAND_NAME}`,
    description:
      "Read practical guides on learning AI for work, building an AI portfolio, and proving AI skills to employers.",
    url: "/learn",
    type: "website",
    images: [{
      url: DEFAULT_OG_IMAGE_PATH,
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
    title: `AI Upskilling Guides and Career Playbooks | ${BRAND_NAME}`,
    description:
      "Read practical guides on learning AI for work, building an AI portfolio, and proving AI skills to employers.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
  keywords: [
    "AI upskilling",
    "AI portfolio",
    "AI skills",
    "learn AI for work",
    "prove AI skills",
  ],
};

function buildLearnHubLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${BRAND_NAME} learning hub`,
    itemListElement: learnArticles.map((article, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: article.title,
      url: `${appBaseUrl}/learn/${article.slug}`,
    })),
  };
}

export default function LearnHubPage() {
  const itemListLd = buildLearnHubLd();
  const quickStartArticles = quickStartSlugs
    .map((slug) => learnArticles.find((article) => article.slug === slug))
    .filter((article): article is NonNullable<typeof article> => Boolean(article));
  const liveGuideCount = learnArticles.length;
  const topicTrackCount = new Set(learnArticles.map((article) => article.category)).size;
  const totalReadingMinutes = learnArticles.reduce((total, article) => total + (Number.parseInt(article.readingTime, 10) || 0), 0);

  return (
    <>
      <main data-gemini-shell="1" className="relative min-h-screen overflow-hidden bg-[#0f111a] pt-20 text-white">
        <div className="bg-glow top-[-180px] left-[-80px] opacity-45"></div>
        <div
          className="bg-glow top-[14%] right-[-220px] opacity-30"
          style={{ background: "radial-gradient(circle, var(--secondary-glow) 0%, rgba(0,0,0,0) 70%)" }}
        ></div>

        <LearningHeader
          active="learning"
          secondaryAction={{ href: "/u/alex-chen-ai", label: "See Example Profile" }}
        />

        <div className="container max-w-6xl py-12">
          <section className="glass-panel relative mb-12 overflow-hidden p-8 md:p-12">
            <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"></div>
            <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"></div>

            <div className="relative z-10 grid gap-8 xl:grid-cols-[1.12fr,0.88fr] xl:items-end">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-300">
                  <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                  Learning hub
                </div>
                <h1 className="max-w-4xl text-5xl font-[Outfit] text-white md:text-6xl">
                  AI upskilling guides built to feel like shipped product, not detached blog posts.
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-300">
                  Start with the roadmap, move into role playbooks and workflow guides, then turn the work into public
                  proof. This hub is designed to match how professionals actually learn AI inside their jobs.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary px-8 py-4 text-lg">
                    Start Assessment
                  </a>
                  <a href="#all-guides" className="btn btn-secondary px-8 py-4 text-lg">
                    Browse Guides
                  </a>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-2">
                <div className="glass rounded-2xl border border-white/10 bg-black/30 p-6 md:col-span-3 xl:col-span-2">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">How to use this hub</div>
                  <div className="space-y-3 text-sm leading-7 text-gray-300">
                    <p>1. Define the career outcome you want and start with the roadmap.</p>
                    <p>2. Pick a role or workflow page that matches the work you already do.</p>
                    <p>3. Turn one guide into one shipped project and one public proof page.</p>
                  </div>
                </div>

                <div className="glass rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Live guides</div>
                  <div className="text-4xl font-[Outfit] text-white">{liveGuideCount}</div>
                </div>
                <div className="glass rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Topic tracks</div>
                  <div className="text-4xl font-[Outfit] text-white">{topicTrackCount}</div>
                </div>
                <div className="glass rounded-2xl border border-white/10 bg-black/30 p-5 md:col-span-3 xl:col-span-2">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Reading runway</div>
                  <div className="text-4xl font-[Outfit] text-white">{totalReadingMinutes} min</div>
                  <p className="mt-2 text-sm leading-6 text-gray-400">Enough depth to build a plan, ship a workflow, and package the proof.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Quick start paths</div>
                <h2 className="text-4xl font-[Outfit] text-white">Use the hub in the same order you would use the product</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-gray-400">
                These three guides give you the most direct path from AI learning, to projects, to employer-facing proof.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {quickStartArticles.map((article, index) => (
                <a
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="glass group relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-6 transition hover:border-emerald-500/40 hover:bg-white/5"
                >
                  <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 bg-gradient-to-bl from-emerald-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                  <div className="relative z-10">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                        Step {index + 1}
                      </span>
                      <span className="text-xs text-gray-500">{article.readingTime}</span>
                    </div>
                    <h3 className="mb-3 text-2xl font-[Outfit] text-white transition group-hover:text-emerald-400">
                      {article.title}
                    </h3>
                    <p className="mb-5 text-sm leading-7 text-gray-300">{article.description}</p>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400">
                      Open guide <span aria-hidden>→</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section id="all-guides" className="mb-12">
            <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">All guides</div>
                <h2 className="text-4xl font-[Outfit] text-white">Start with the page that matches the job-to-be-done</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-gray-400">
                Every guide is written to connect to the next step in the learning loop: skill acquisition, workflow design, project shipping, and proof packaging.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {learnArticles.map((article) => (
                <a
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="glass group rounded-3xl border border-white/10 bg-black/20 p-6 transition hover:border-emerald-500/40 hover:bg-white/5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                      {article.category}
                    </span>
                    <span className="text-xs text-gray-500">{article.readingTime}</span>
                  </div>
                  <h3 className="mb-3 text-2xl font-[Outfit] text-white transition group-hover:text-emerald-400">
                    {article.title}
                  </h3>
                  <p className="mb-5 text-sm leading-7 text-gray-300">{article.description}</p>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {article.keywords.slice(0, 3).map((keyword) => (
                      <span key={keyword} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">
                        {keyword}
                      </span>
                    ))}
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400">
                    Read guide <span aria-hidden>→</span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="glass rounded-3xl border border-white/10 bg-black/25 p-8">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Role playbooks</div>
              <h3 className="mb-3 text-2xl font-[Outfit] text-white">Role-specific AI skill stacks</h3>
              <p className="text-sm leading-7 text-gray-300">
                Product, marketing, and operations pages now sit alongside the core roadmap so people can move from broad AI learning into role-level leverage.
              </p>
            </div>
            <div className="glass rounded-3xl border border-white/10 bg-black/25 p-8">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">Workflow guides</div>
              <h3 className="mb-3 text-2xl font-[Outfit] text-white">Systems and workflow execution</h3>
              <p className="text-sm leading-7 text-gray-300">
                Prompt engineering, workflow automation, and portfolio project ideas are framed as systems work rather than disconnected AI tool tips.
              </p>
            </div>
            <div className="glass rounded-3xl border border-white/10 bg-black/25 p-8">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">What ships next</div>
              <h3 className="mb-3 text-2xl font-[Outfit] text-white">Case studies and proof stories</h3>
              <p className="text-sm leading-7 text-gray-300">
                The next content layer should show before-and-after learner stories so search traffic lands on evidence, not just advice.
              </p>
            </div>
          </section>
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
    </>
  );
}
