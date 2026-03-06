import type { Metadata } from "next";
import Link from "next/link";
import { LearningFooter } from "@/components/learning-footer";
import { LearningHeader } from "@/components/learning-header";
import { getLearnArticles } from "@/lib/learn-content";
import { getLearningCollectionsWithArticles } from "@/lib/learning-taxonomy";
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

function collectionToneClasses(theme: "emerald" | "cyan" | "amber") {
  if (theme === "emerald") return "bg-emerald-500/15 text-emerald-500";
  if (theme === "cyan") return "bg-cyan-500/15 text-cyan-500";
  return "bg-amber-500/15 text-amber-500";
}

function collectionAccentClasses(theme: "emerald" | "cyan" | "amber") {
  if (theme === "emerald") return "text-emerald-500";
  if (theme === "cyan") return "text-cyan-500";
  return "text-amber-500";
}

function collectionIcon(id: string) {
  if (id === "role-playbooks") return "fa-solid fa-user-gear";
  if (id === "workflow-guides") return "fa-solid fa-diagram-project";
  return "fa-solid fa-award";
}

export default function LearnHubPage() {
  const itemListLd = buildLearnHubLd();
  const collections = getLearningCollectionsWithArticles(learnArticles);
  const quickStartArticles = quickStartSlugs
    .map((slug) => learnArticles.find((article) => article.slug === slug))
    .filter((article): article is NonNullable<typeof article> => Boolean(article));
  const liveGuideCount = learnArticles.length;
  const topicTrackCount = new Set(learnArticles.map((article) => article.category)).size;
  const totalReadingMinutes = learnArticles.reduce((total, article) => total + (Number.parseInt(article.readingTime, 10) || 0), 0);

  return (
    <>
      <main data-gemini-shell="1" className="gemini-light-shell learning-shell relative min-h-screen overflow-hidden pt-48 text-white md:pt-36">
        <div className="bg-glow top-[-180px] left-[-80px] opacity-45"></div>
        <div
          className="bg-glow top-[14%] right-[-220px] opacity-30"
          style={{ background: "radial-gradient(circle, var(--secondary-glow) 0%, rgba(0,0,0,0) 70%)" }}
        ></div>

        <LearningHeader
          active="learning"
          activeTab="start-here"
          secondaryAction={{ href: "/u/alex-chen-ai", label: "See Example Profile" }}
        />

        <div className="container max-w-6xl py-12">
          <section className="relative mb-14 grid items-center gap-10 pb-6 pt-4 xl:grid-cols-[1.08fr,0.92fr]">
            <div className="z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                Practical AI learning for work
              </div>
              <h1 className="mb-6 max-w-5xl text-5xl lg:text-7xl">
                The editorial home for AI skills, workflow systems, and <span className="text-gradient">proof-based career growth.</span>
              </h1>
              <p className="mb-8 max-w-2xl text-xl leading-relaxed text-gray-400">
                Read practical guides on what to learn, what to build, and how to turn that work into public proof employers can inspect.
              </p>
              <div className="mb-10 flex flex-col gap-4 sm:flex-row">
                <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary px-8 py-4 text-lg">
                  Start Assessment
                </a>
                <a href="#all-guides" className="btn btn-secondary px-8 py-4 text-lg">
                  Browse Guides
                </a>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex -space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 bg-emerald-500 text-xs font-bold text-white">
                    {liveGuideCount}
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 bg-cyan-500 text-[10px] font-bold text-white">
                    {topicTrackCount}
                  </div>
                </div>
                <p>{totalReadingMinutes} minutes of role playbooks, workflow guides, and proof-building reads.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass rounded-[28px] p-6 sm:col-span-2">
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-xl text-emerald-500">
                    <i className="fa-solid fa-compass-drafting"></i>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">How to use this journal</div>
                    <p className="text-sm leading-7 text-gray-400">
                      Start with the roadmap, choose the role or workflow guide that matches your real work, then turn one guide into one shipped proof artifact.
                    </p>
                  </div>
                </div>
                <div className="space-y-3 text-sm leading-7 text-gray-400">
                  <p>1. Define the outcome you want and anchor on the roadmap.</p>
                  <p>2. Build a workflow that maps to work you already own.</p>
                  <p>3. Publish the result as visible career proof.</p>
                </div>
              </div>

              <div className="glass rounded-2xl p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-lg text-emerald-500">
                  <i className="fa-solid fa-book-open-reader"></i>
                </div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Live guides</div>
                <div className="text-4xl font-[Outfit] text-white">{liveGuideCount}</div>
              </div>
              <div className="glass rounded-2xl p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-lg text-cyan-500">
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Topic tracks</div>
                <div className="text-4xl font-[Outfit] text-white">{topicTrackCount}</div>
              </div>
              <div className="glass rounded-2xl p-5 sm:col-span-2">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-lg text-amber-500">
                  <i className="fa-solid fa-hourglass-half"></i>
                </div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Reading runway</div>
                <div className="text-4xl font-[Outfit] text-white">{totalReadingMinutes} min</div>
                <p className="mt-2 text-sm leading-6 text-gray-400">Enough depth to build a plan, ship a workflow, and package the proof.</p>
              </div>
            </div>
          </section>

          <section id="latest" className="mb-12">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Start Here</div>
                <h2 className="text-4xl font-[Outfit] text-white">Begin with the guides that define the whole publication</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-gray-400">
                These three pieces establish the core lens of the journal: learn the right skill, build something real, then package the proof.
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
                <h2 className="text-4xl font-[Outfit] text-white">Browse the full archive by the job-to-be-done</h2>
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

          <section id="collections" className="grid gap-6 lg:grid-cols-3">
            {collections.map((collection) => (
              <div
                key={collection.id}
                id={`collection-${collection.id}`}
                className="glass rounded-3xl border border-white/10 bg-black/25 p-8"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${collectionToneClasses(collection.theme)} text-xl`}>
                    <i className={collectionIcon(collection.id)}></i>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                    {collection.articleCount} guides
                  </div>
                </div>
                <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.18em] ${collectionAccentClasses(collection.theme)}`}>
                  {collection.label}
                </div>
                <h3 className="mb-3 text-2xl font-[Outfit] text-white">{collection.title}</h3>
                <p className="mb-6 text-sm leading-7 text-gray-300">
                  {collection.description}
                </p>
                <div className="space-y-3">
                  {collection.articles.slice(0, 3).map((article) => (
                    <a
                      key={article.slug}
                      href={`/learn/${article.slug}`}
                      className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300 transition hover:border-emerald-500/30 hover:text-slate-900"
                    >
                      {article.title}
                    </a>
                  ))}
                </div>
                <div className="mt-6">
                  <a
                    href={collection.articles[0] ? `/learn/${collection.articles[0].slug}` : "/learn#all-guides"}
                    className="btn btn-secondary w-full justify-center"
                  >
                    {collection.ctaLabel}
                  </a>
                </div>
              </div>
            ))}
          </section>

          <LearningFooter />
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
    </>
  );
}
