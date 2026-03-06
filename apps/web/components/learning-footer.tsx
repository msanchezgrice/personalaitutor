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

export function LearningFooter({ currentSlug }: LearningFooterProps) {
  const articles = getLearnArticles();
  const collections = getLearningCollectionsWithArticles(articles);
  const latestArticles = getLatestLearningArticles(articles, 5).filter((article) => article.slug !== currentSlug).slice(0, 3);

  return (
    <footer className="learning-footer mt-16 overflow-hidden border-t border-slate-200/80">
      <div className="container max-w-6xl py-10 md:py-12">
        <section className="mb-8 rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600">Next Step</div>
              <h2 className="max-w-2xl text-xl font-[Outfit] text-slate-900 sm:text-2xl">
                Read one guide, ship one workflow, publish one proof artifact.
              </h2>
            </div>

            <div className="min-w-0 flex flex-col gap-3 sm:flex-row">
              <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary justify-center">
                Start Assessment
              </a>
              <Link href="/u/alex-chen-ai" className="btn btn-secondary justify-center">
                Example Profile
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-8 border-t border-slate-200 pt-8 md:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr),minmax(0,1fr)]">
          <section className="min-w-0 space-y-4">
            <Link href="/learn" className="inline-flex items-center gap-3">
              <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
              <div>
                <div className="font-[Outfit] text-2xl font-semibold text-slate-900">{BRAND_NAME}</div>
                <div className="text-sm text-slate-500">Learning Journal</div>
              </div>
            </Link>
            <p className="max-w-sm text-sm leading-7 text-slate-600">
              <span className="sm:hidden">Practical writing for AI skills, workflow leverage, and public proof.</span>
              <span className="hidden sm:inline">Practical writing for people building AI skills, workflow leverage, portfolio proof, and clearer career stories.</span>
            </p>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <a href={BRAND_X_URL} target="_blank" rel="noreferrer" className="rounded-full border border-slate-300 bg-white px-4 py-2 hover:border-cyan-400/60 hover:text-slate-900 transition">
                X
              </a>
              <a href={BRAND_LINKEDIN_URL} target="_blank" rel="noreferrer" className="rounded-full border border-slate-300 bg-white px-4 py-2 hover:border-cyan-400/60 hover:text-slate-900 transition">
                LinkedIn
              </a>
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Explore</div>
            <div className="space-y-3 text-sm text-slate-600">
              <a href="/learn#latest" className="block hover:text-slate-900 transition">Start Here</a>
              <a href="/learn#all-guides" className="block hover:text-slate-900 transition">All Guides</a>
              {collections.map((collection) => (
                <a key={collection.id} href={collection.href} className="block hover:text-slate-900 transition">
                  {collection.label}
                </a>
              ))}
              <a href="/" className="block hover:text-slate-900 transition">Home</a>
              <a href="/employers" className="block hover:text-slate-900 transition">For Employers</a>
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Read Next</div>
            <div className="space-y-3 text-sm text-slate-600">
              {latestArticles.map((article) => (
                <a
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="block hover:text-slate-900 transition"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {article.category}
                  </div>
                  <div className="mt-1 text-sm font-medium leading-6 text-slate-900">{article.title}</div>
                </a>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>Learning is the editorial layer of {BRAND_NAME}.</p>
          <p>Use the guides to move from AI reading into shipped workflow proof.</p>
        </div>
      </div>
    </footer>
  );
}
