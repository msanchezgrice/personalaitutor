import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LearningFooter } from "@/components/learning-footer";
import { LearningHeader } from "@/components/learning-header";
import {
  getLearnArticleBySlug,
  getLearnArticles,
} from "@/lib/learn-content";
import { getLearningCollectionIdForCategory } from "@/lib/learning-taxonomy";
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

function renderInlineLinks(text: string) {
  return text
    .split(/(\[[^\]]+\]\([^)]+\))/g)
    .filter(Boolean)
    .map((part, index) => {
      const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);

      if (!match) {
        return <span key={`${index}-${part.slice(0, 24)}`}>{part}</span>;
      }

      const [, label, href] = match;
      const className =
        "text-emerald-500 underline decoration-emerald-500/40 underline-offset-4 transition hover:text-emerald-600";

      if (href.startsWith("/")) {
        return (
          <a key={`${index}-${href}`} href={href} className={className}>
            {label}
          </a>
        );
      }

      return (
        <a key={`${index}-${href}`} href={href} className={className} target="_blank" rel="noreferrer">
          {label}
        </a>
      );
    });
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

function statToneClasses(tone: "emerald" | "cyan" | "amber") {
  if (tone === "emerald") return "bg-emerald-500/15 text-emerald-500";
  if (tone === "cyan") return "bg-cyan-500/15 text-cyan-500";
  return "bg-amber-500/15 text-amber-500";
}

export default async function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getLearnArticleBySlug(slug);

  if (!article) notFound();

  const relatedArticles = article.relatedSlugs
    .map((relatedSlug) => getLearnArticleBySlug(relatedSlug))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const articleUrl = `${appBaseUrl}/learn/${article.slug}`;
  const activeTab = getLearningCollectionIdForCategory(article.category);

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
      <main data-gemini-shell="1" className="gemini-light-shell learning-shell relative min-h-screen overflow-hidden pt-48 text-white md:pt-36">
        <div className="bg-glow top-[-180px] left-[-120px] opacity-45"></div>
        <div
          className="bg-glow top-[16%] right-[-220px] opacity-30"
          style={{ background: "radial-gradient(circle, var(--secondary-glow) 0%, rgba(0,0,0,0) 70%)" }}
        ></div>

        <LearningHeader
          active="learning"
          activeTab={activeTab}
          secondaryAction={{ href: "/learn", label: "All Guides" }}
        />

        <div className="container max-w-6xl py-12">
          <section className="relative mb-12 grid items-start gap-10 pb-4 pt-4 xl:grid-cols-[1.08fr,0.92fr]">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-gray-400">
                <Link href="/" className="hover:text-slate-900 transition">Home</Link>
                <span>/</span>
                <Link href="/learn" className="hover:text-slate-900 transition">Learning Journal</Link>
                <span>/</span>
                <span className="text-gray-300">{article.title}</span>
              </div>

              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                {article.category}
              </div>
              <h1 className="max-w-5xl text-5xl lg:text-7xl">{article.title}</h1>
              <p className="mt-6 max-w-3xl text-xl leading-relaxed text-gray-400">{article.heroSummary}</p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-400">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Published {formatDate(article.publishedAt)}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Updated {formatDate(article.updatedAt)}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{article.readingTime}</span>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary">
                  Start Assessment
                </a>
                <Link href="/u/alex-chen-ai" className="btn btn-secondary">
                  See Example Profile
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass rounded-[28px] p-6 sm:col-span-2">
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-xl text-cyan-500">
                    <i className="fa-solid fa-book-open-reader"></i>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-500">What this guide gives you</div>
                    <p className="text-sm leading-7 text-gray-400">
                      A concrete breakdown of the workflow, what matters most, and what proof to publish once the work is done.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {article.takeaways.map((takeaway) => (
                    <div key={takeaway} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-gray-300">
                      {takeaway}
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-2xl p-5">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${statToneClasses("emerald")} text-lg`}>
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Sections</div>
                <div className="text-4xl font-[Outfit] text-white">{article.sections.length}</div>
              </div>
              <div className="glass rounded-2xl p-5">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${statToneClasses("cyan")} text-lg`}>
                  <i className="fa-solid fa-circle-question"></i>
                </div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">FAQ items</div>
                <div className="text-4xl font-[Outfit] text-white">{article.faq.length}</div>
              </div>
              <div className="glass rounded-2xl p-5 sm:col-span-2">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${statToneClasses("amber")} text-lg`}>
                  <i className="fa-solid fa-tags"></i>
                </div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Keywords</div>
                <div className="text-4xl font-[Outfit] text-white">{article.keywords.length}</div>
                <p className="mt-2 text-sm leading-6 text-gray-400">Structured to help readers learn the skill, build the workflow, and package the proof.</p>
              </div>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr),320px]">
            <article className="space-y-8">
              {article.sections.map((section, index) => (
                <section key={section.id} id={section.id} className="glass rounded-3xl border border-white/10 bg-black/20 p-8">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                    Section {String(index + 1).padStart(2, "0")}
                  </div>
                  <h2 className="mb-5 text-3xl font-[Outfit] text-white">{section.title}</h2>
                  <div className="space-y-5 text-base leading-8 text-gray-300">
                    {section.paragraphs.map((paragraph, paragraphIndex) => (
                      <p key={`${section.id}-paragraph-${paragraphIndex}`}>{renderInlineLinks(paragraph)}</p>
                    ))}
                  </div>
                  {section.bullets?.length ? (
                    <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                      <ul className="space-y-3">
                        {section.bullets.map((bullet, bulletIndex) => (
                          <li key={`${section.id}-bullet-${bulletIndex}`} className="flex items-start gap-3 text-sm leading-7 text-gray-300">
                            <span className="mt-2 h-2 w-2 rounded-full bg-emerald-400"></span>
                            <span>{renderInlineLinks(bullet)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
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
                  {article.sections.map((section, index) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300 transition hover:border-emerald-500/30 hover:text-slate-900"
                    >
                      <span className="mr-2 text-[11px] uppercase tracking-[0.16em] text-gray-500">{String(index + 1).padStart(2, "0")}</span>
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

              <section className="glass rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-6">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Turn this into proof</div>
                <h2 className="mb-3 text-2xl font-[Outfit] text-white">Build the workflow, then publish the evidence.</h2>
                <p className="mb-5 text-sm leading-7 text-gray-300">
                  The highest-leverage path is still the same: one guide becomes one workflow, one workflow becomes one project, and one project becomes visible proof.
                </p>
                <div className="flex flex-col gap-3">
                  <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary text-center">Start Assessment</a>
                  <a href="/u/alex-chen-ai" className="btn btn-secondary text-center">See Example Profile</a>
                </div>
              </section>

              <section className="glass rounded-3xl border border-white/10 bg-black/25 p-6">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Share</div>
                <div className="space-y-3 text-sm text-gray-300">
                  <a href={BRAND_X_URL} target="_blank" rel="noreferrer" className="block hover:text-slate-900 transition">Follow on X</a>
                  <a href={BRAND_LINKEDIN_URL} target="_blank" rel="noreferrer" className="block hover:text-slate-900 transition">Follow on LinkedIn</a>
                  <a href={articleUrl} className="block hover:text-slate-900 transition">Copy article URL</a>
                </div>
              </section>
            </aside>
          </div>

          <LearningFooter currentSlug={article.slug} />
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </>
  );
}
