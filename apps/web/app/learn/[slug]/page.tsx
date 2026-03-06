import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLearnArticleBySlug,
  getLearnArticles,
} from "@/lib/learn-content";
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

function formatDate(input: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${input}T12:00:00Z`));
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getLearnArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getLearnArticleBySlug(slug);

  if (!article) {
    return {
      title: "Guide not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const pageTitle = `${article.title} | ${BRAND_NAME}`;

  return {
    title: pageTitle,
    description: article.description,
    alternates: {
      canonical: `/learn/${article.slug}`,
    },
    openGraph: {
      title: pageTitle,
      description: article.description,
      url: `/learn/${article.slug}`,
      type: "article",
      publishedTime: `${article.publishedAt}T12:00:00Z`,
      modifiedTime: `${article.updatedAt}T12:00:00Z`,
      authors: [BRAND_NAME],
      tags: article.keywords,
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
      title: pageTitle,
      description: article.description,
      images: [DEFAULT_OG_IMAGE_PATH],
    },
    keywords: article.keywords,
  };
}

export default async function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getLearnArticleBySlug(slug);

  if (!article) notFound();

  const relatedArticles = article.relatedSlugs
    .map((relatedSlug) => getLearnArticleBySlug(relatedSlug))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const articleUrl = `${appBaseUrl}/learn/${article.slug}`;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: `${article.publishedAt}T12:00:00Z`,
    dateModified: `${article.updatedAt}T12:00:00Z`,
    author: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: appBaseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: appBaseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${appBaseUrl}/assets/branding/brand_brain_icon.svg`,
      },
    },
    mainEntityOfPage: articleUrl,
    image: [`${appBaseUrl}${DEFAULT_OG_IMAGE_PATH}`],
    keywords: article.keywords.join(", "),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: article.faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: appBaseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Learn",
        item: `${appBaseUrl}/learn`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: articleUrl,
      },
    ],
  };

  return (
    <>
      <main className="gemini-light-shell relative min-h-screen overflow-hidden">
        <div className="bg-glow top-[-180px] left-[-120px] opacity-45"></div>
        <div
          className="bg-glow top-[16%] right-[-220px] opacity-30"
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
              <Link href="/learn" className="btn btn-secondary">All Guides</Link>
              <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary">Start Assessment</a>
            </div>
          </div>
        </header>

        <section className="container py-16 md:py-20">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-gray-400">
            <a href="/" className="hover:text-white transition">Home</a>
            <span>/</span>
            <a href="/learn" className="hover:text-white transition">Learn</a>
            <span>/</span>
            <span className="text-gray-200">{article.title}</span>
          </div>

          <div className="mb-10 max-w-4xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
              {article.category}
            </div>
            <h1 className="max-w-5xl text-5xl font-[Outfit] text-white md:text-6xl">{article.title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-300">{article.heroSummary}</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-400">
              <span>Published {formatDate(article.publishedAt)}</span>
              <span>Updated {formatDate(article.updatedAt)}</span>
              <span>{article.readingTime}</span>
            </div>
          </div>

          <div className="grid gap-10 xl:grid-cols-[0.72fr,0.28fr]">
            <article className="space-y-10">
              <section className="glass rounded-3xl border border-white/10 bg-black/20 p-8">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Key takeaways</div>
                <div className="grid gap-3 md:grid-cols-2">
                  {article.takeaways.map((takeaway) => (
                    <div key={takeaway} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-gray-300">
                      {takeaway}
                    </div>
                  ))}
                </div>
              </section>

              {article.sections.map((section) => (
                <section key={section.id} id={section.id} className="glass rounded-3xl border border-white/10 bg-black/20 p-8">
                  <h2 className="mb-5 text-3xl font-[Outfit] text-white">{section.title}</h2>
                  <div className="space-y-5 text-base leading-8 text-gray-300">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  {section.bullets?.length ? (
                    <ul className="mt-6 space-y-3">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-3 text-sm leading-7 text-gray-300">
                          <span className="mt-2 h-2 w-2 rounded-full bg-emerald-400"></span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}

              <section className="glass rounded-3xl border border-white/10 bg-black/20 p-8">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">FAQ</div>
                <h2 className="mb-6 text-3xl font-[Outfit] text-white">Frequently asked questions</h2>
                <div className="space-y-4">
                  {article.faq.map((entry) => (
                    <div key={entry.question} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <h3 className="mb-2 text-lg font-medium text-white">{entry.question}</h3>
                      <p className="text-sm leading-7 text-gray-300">{entry.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            </article>

            <aside className="space-y-6">
              <section className="glass sticky top-28 rounded-3xl border border-white/10 bg-black/25 p-6">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Article outline</div>
                <div className="space-y-3">
                  {article.sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300 transition hover:border-emerald-500/30 hover:text-white"
                    >
                      {section.title}
                    </a>
                  ))}
                </div>
              </section>

              <section className="glass rounded-3xl border border-white/10 bg-black/25 p-6">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">Keywords</div>
                <div className="flex flex-wrap gap-2">
                  {article.keywords.map((keyword) => (
                    <span key={keyword} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-gray-300">
                      {keyword}
                    </span>
                  ))}
                </div>
              </section>

              {relatedArticles.length ? (
                <section className="glass rounded-3xl border border-white/10 bg-black/25 p-6">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Read next</div>
                  <div className="space-y-4">
                    {relatedArticles.map((related) => (
                      <a
                        key={related.slug}
                        href={`/learn/${related.slug}`}
                        className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-500/30 hover:bg-white/10"
                      >
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{related.category}</div>
                        <div className="mb-2 text-base font-medium text-white">{related.title}</div>
                        <p className="text-sm leading-7 text-gray-300">{related.description}</p>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="glass rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Turn this into proof</div>
                <h2 className="mb-3 text-2xl font-[Outfit] text-white">Build the project, then publish the evidence.</h2>
                <p className="mb-5 text-sm leading-7 text-gray-300">
                  The real upside comes from turning one guide into one workflow, one workflow into one project, and one project into public proof.
                </p>
                <div className="flex flex-col gap-3">
                  <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary text-center">Start Assessment</a>
                  <a href="/u/alex-chen-ai" className="btn btn-secondary text-center">See Example Profile</a>
                </div>
              </section>

              <section className="glass rounded-3xl border border-white/10 bg-black/25 p-6">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Share</div>
                <div className="space-y-3 text-sm text-gray-300">
                  <a href={BRAND_X_URL} target="_blank" rel="noreferrer" className="block hover:text-white transition">Follow on X</a>
                  <a href={BRAND_LINKEDIN_URL} target="_blank" rel="noreferrer" className="block hover:text-white transition">Follow on LinkedIn</a>
                  <a href={articleUrl} className="block hover:text-white transition">Copy article URL</a>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </>
  );
}
