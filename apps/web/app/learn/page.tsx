import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <>
      <main className="gemini-light-shell relative min-h-screen overflow-hidden">
        <div className="bg-glow top-[-180px] left-[-80px] opacity-45"></div>
        <div
          className="bg-glow top-[14%] right-[-220px] opacity-30"
          style={{ background: "radial-gradient(circle, var(--secondary-glow) 0%, rgba(0,0,0,0) 70%)" }}
        ></div>

        <header className="glass sticky top-0 z-50 rounded-none border-x-0 border-t-0 bg-opacity-80 backdrop-blur-xl">
          <div className="container nav py-4">
            <Link href="/" className="flex items-center gap-3">
              <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
              <span className="font-[Outfit] text-[1.85rem] font-bold leading-none tracking-tight text-slate-900">
                {BRAND_NAME}
              </span>
            </Link>
            <div className="flex gap-4">
              <Link href="/employers" className="btn btn-secondary">For Employers</Link>
              <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary">Start Assessment</a>
            </div>
          </div>
        </header>

        <section className="container relative py-20 md:py-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-300">
            Evergreen guides for AI skills and career leverage
          </div>
          <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-end">
            <div>
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">Learn</div>
              <h1 className="max-w-4xl text-5xl font-[Outfit] text-white md:text-6xl">
                AI upskilling guides for people who need shipped proof, not vague advice.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-300">
                This hub is built around practical AI adoption for working professionals: how to learn the right skills,
                what projects to build, how to package them into an AI portfolio, and how to prove the work to employers.
              </p>
            </div>
            <div className="glass rounded-3xl border border-white/10 bg-black/25 p-6">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">How to use this hub</div>
              <div className="space-y-3 text-sm leading-7 text-gray-300">
                <p>1. Start with the roadmap if you are still defining your AI learning plan.</p>
                <p>2. Move to the portfolio guide once you have one or two projects in progress.</p>
                <p>3. Use the employer-proof guide to turn those projects into resume, LinkedIn, and interview assets.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="container pb-24">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Featured guides</div>
              <h2 className="text-4xl font-[Outfit] text-white">Start with the pages that solve the biggest career questions</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-gray-400">
              Each guide is written to be useful on its own and to connect to the next step in the AI learning and proof-building process.
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

        <section className="border-y border-white/5 bg-black/25 py-24">
          <div className="container grid gap-8 md:grid-cols-3">
            <div className="glass rounded-3xl p-8">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Next content batch</div>
              <h3 className="mb-3 text-2xl font-[Outfit] text-white">Role pages</h3>
              <p className="text-sm leading-7 text-gray-300">
                Build role-specific pages for marketers, product managers, operators, sales teams, support leads, and founders.
              </p>
            </div>
            <div className="glass rounded-3xl p-8">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">Next content batch</div>
              <h3 className="mb-3 text-2xl font-[Outfit] text-white">Skill pages</h3>
              <p className="text-sm leading-7 text-gray-300">
                Add pages for prompt engineering, workflow automation, AI research systems, API integrations, and AI portfolio strategy.
              </p>
            </div>
            <div className="glass rounded-3xl p-8">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Next content batch</div>
              <h3 className="mb-3 text-2xl font-[Outfit] text-white">Case studies</h3>
              <p className="text-sm leading-7 text-gray-300">
                Publish before-and-after stories showing how real learners turned AI projects into visible professional proof.
              </p>
            </div>
          </div>
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
    </>
  );
}
