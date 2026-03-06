import Link from "next/link";
import { getLearnArticles } from "@/lib/learn-content";
import {
  getLatestLearningArticles,
  getLearningCollectionsWithArticles,
} from "@/lib/learning-taxonomy";
import {
  BRAND_LINKEDIN_URL,
  BRAND_NAME,
  BRAND_X_URL,
} from "@/lib/site";

type LearningFooterProps = {
  currentSlug?: string;
};

function themeClass(theme: "emerald" | "cyan" | "amber") {
  if (theme === "emerald") return "text-emerald-400 border-emerald-500/20";
  if (theme === "cyan") return "text-cyan-400 border-cyan-500/20";
  return "text-amber-400 border-amber-500/20";
}

export function LearningFooter({ currentSlug }: LearningFooterProps) {
  const articles = getLearnArticles();
  const collections = getLearningCollectionsWithArticles(articles);
  const latestArticles = getLatestLearningArticles(articles, 5).filter((article) => article.slug !== currentSlug).slice(0, 4);

  return (
    <footer className="learning-footer mt-16 overflow-hidden border-t border-white/10">
      <div className="container max-w-6xl py-12">
        <section className="glass-panel mb-10 overflow-hidden p-8 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)] lg:items-center">
            <div className="min-w-0">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">The Learning Journal</div>
              <h2 className="max-w-3xl text-4xl font-[Outfit] text-white">
                Keep reading, then turn one guide into one shipped workflow.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300">
                This part of My AI Skill Tutor is the public editorial layer for AI skills, workflow systems, and
                employer-facing proof. Read the guide, build the workflow, then publish the evidence.
              </p>
            </div>

            <div className="min-w-0 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary justify-center">
                Start Assessment
              </a>
              <Link href="/u/alex-chen-ai" className="btn btn-secondary justify-center">
                Example Profile
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr),minmax(0,0.85fr),minmax(0,1fr),minmax(0,1fr)]">
          <section className="min-w-0 space-y-5">
            <Link href="/learn" className="inline-flex items-center gap-3">
              <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
              <div>
                <div className="font-[Outfit] text-2xl font-semibold text-white">{BRAND_NAME}</div>
                <div className="text-sm text-gray-400">Learning Journal</div>
              </div>
            </Link>
            <p className="max-w-sm text-sm leading-7 text-gray-400">
              Practical writing for people building AI skills, workflow leverage, portfolio proof, and clearer career stories.
            </p>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <a href={BRAND_X_URL} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-4 py-2 hover:border-cyan-500/30 hover:text-white transition">
                X
              </a>
              <a href={BRAND_LINKEDIN_URL} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-4 py-2 hover:border-cyan-500/30 hover:text-white transition">
                LinkedIn
              </a>
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Navigate</div>
            <div className="space-y-3 text-sm text-gray-300">
              <a href="/learn#latest" className="block hover:text-white transition">Start Here</a>
              <a href="/learn#all-guides" className="block hover:text-white transition">All Guides</a>
              <a href="/learn#collections" className="block hover:text-white transition">Collections</a>
              <a href="/" className="block hover:text-white transition">Home</a>
              <a href="/employers" className="block hover:text-white transition">For Employers</a>
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Collections</div>
            <div className="space-y-4">
              {collections.map((collection) => (
                <a
                  key={collection.id}
                  href={collection.href}
                  className="block min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${themeClass(collection.theme).split(" ")[0]}`}>
                    {collection.label}
                  </div>
                  <div className="mb-2 text-base font-medium text-white">{collection.articleCount} live guides</div>
                  <p className="text-sm leading-6 text-gray-400">{collection.description}</p>
                </a>
              ))}
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Latest Reads</div>
            <div className="space-y-4">
              {latestArticles.map((article) => (
                <a
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="block min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {article.category}
                  </div>
                  <div className="mb-2 text-base font-medium text-white">{article.title}</div>
                  <p className="text-sm leading-6 text-gray-400">{article.description}</p>
                </a>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-gray-400 md:flex-row md:items-center md:justify-between">
          <p>Learning is the editorial layer of {BRAND_NAME}.</p>
          <p>Originally the bottom cards were roadmap placeholders. Publishing next: learner case studies and before/after proof stories.</p>
        </div>
      </div>
    </footer>
  );
}
