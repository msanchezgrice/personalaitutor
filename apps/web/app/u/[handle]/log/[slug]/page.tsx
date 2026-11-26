import React from "react";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getAuthSeed } from "@/lib/auth";
import { runtimeFindUserByHandle, runtimeFindUserById } from "@/lib/runtime";
import { BRAND_NAME, BRAND_X_HANDLE, getSiteUrl } from "@/lib/site";
import { findBuildLogPostBySlug } from "@/lib/build-log/store";
import { getAuthorNewTitle } from "@/lib/build-log/context";
import { isValidBuildLogSlug } from "@/lib/build-log/slug";
import { BuildLogMarkdown, markdownToPlainText } from "@/lib/build-log/markdown";
import { formatBuildLogLongDate } from "@/lib/build-log/format";
import prose from "@/components/proof/build-log-prose.module.css";
import styles from "@/components/proof/build-log-article.module.css";

/**
 * Public build log article. Visible to everyone only when the learner's
 * profile is published AND the post is published. The owner, signed in, can
 * preview a draft (or a post on an unpublished profile); everyone else gets 404.
 */

export const dynamic = "force-dynamic";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const resolveArticle = cache(async (rawHandle: string, rawSlug: string) => {
  const handle = decodeURIComponent(rawHandle).trim();
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
  if (!handle || !isValidBuildLogSlug(slug)) return null;

  const profile = await runtimeFindUserByHandle(handle);
  if (!profile) return null;
  const post = await findBuildLogPostBySlug({ learnerProfileId: profile.id, slug });
  if (!post) return null;

  const isPublic = profile.published && post.status === "published";
  if (!isPublic) {
    const seed = await getAuthSeed().catch(() => null);
    if (!seed?.userId) return null;
    const viewer = await runtimeFindUserById(seed.userId).catch(() => null);
    if (!viewer || viewer.id !== profile.id) return null;
  }

  const newTitle = await getAuthorNewTitle(profile.id);
  return { profile, post, newTitle, isPublic };
});

function articlePath(handle: string, slug: string) {
  return `/u/${encodeURIComponent(handle)}/log/${encodeURIComponent(slug)}`;
}

function descriptionFor(post: { summary: string; bodyMarkdown: string }) {
  return post.summary.trim() || markdownToPlainText(post.bodyMarkdown, 200);
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string; slug: string }> }): Promise<Metadata> {
  const { handle, slug } = await params;
  const article = await resolveArticle(handle, slug);
  if (!article) {
    return { title: "Post not found", robots: { index: false, follow: false } };
  }
  const { profile, post, isPublic } = article;
  const path = articlePath(profile.handle, post.slug);
  const title = `${post.title} | ${profile.name}`;
  const description = descriptionFor(post);
  const ogImage = `/api/og/log/${encodeURIComponent(profile.handle)}/${encodeURIComponent(post.slug)}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: post.title,
      description,
      url: path,
      type: "article",
      siteName: BRAND_NAME,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: [`/u/${profile.handle}`],
      images: isPublic ? [{ url: ogImage, width: OG_WIDTH, height: OG_HEIGHT, alt: post.title, type: "image/png" }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      site: BRAND_X_HANDLE,
      title: post.title,
      description,
      images: isPublic ? [ogImage] : undefined,
    },
    robots: isPublic ? undefined : { index: false, follow: false },
  };
}

export default async function BuildLogArticlePage({ params }: { params: Promise<{ handle: string; slug: string }> }) {
  const { handle, slug } = await params;
  const article = await resolveArticle(handle, slug);
  if (!article) notFound();
  const { profile, post, newTitle, isPublic } = article;

  const siteUrl = getSiteUrl();
  const path = articlePath(profile.handle, post.slug);
  const profilePath = `/u/${encodeURIComponent(profile.handle)}`;
  const firstName = profile.name.split(" ")[0] || profile.name;
  const dateIso = post.publishedAt ?? post.updatedAt;

  const blogPostingLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: descriptionFor(post),
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt,
    url: `${siteUrl}${path}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}${path}` },
    image: `${siteUrl}/api/og/log/${encodeURIComponent(profile.handle)}/${encodeURIComponent(post.slug)}`,
    author: {
      "@type": "Person",
      name: profile.name,
      url: `${siteUrl}${profilePath}`,
      ...(newTitle ? { jobTitle: newTitle } : {}),
    },
    publisher: { "@type": "Organization", name: BRAND_NAME, url: siteUrl },
  };

  return (
    <div className="rm">
      <header className={styles.topbar}>
        <div className={`rm-container rm-container--narrow ${styles.topbarInner}`}>
          <a href="/" className={styles.brand}>
            <img src="/assets/branding/brand_brain_icon.svg" alt="" width={28} height={28} />
            <span>
              A proof page on <strong>{BRAND_NAME}</strong>
            </span>
          </a>
          <a href="/map" className={styles.mapLink} data-testid="cta-map-career-buildlog">
            Map your own career
          </a>
        </div>
      </header>

      <main>
        <article className={styles.article} data-testid="build-log-article">
          {isPublic ? null : (
            <p className="rm-alert" role="status" data-testid="build-log-preview-banner">
              Preview: only you can see this.{" "}
              {post.status !== "published"
                ? "Publish the post to share it."
                : "It goes public once your site is published."}{" "}
              <a href="/dashboard/proof/log">Back to your build log</a>
            </p>
          )}
          <header className={styles.header}>
            <p className="rm-kicker">
              <a href={profilePath} style={{ textDecoration: "none" }}>
                Build log
              </a>
            </p>
            <h1 className={`rm-h1 ${styles.title}`}>{post.title}</h1>
            <div className={styles.byline}>
              <a href={profilePath} className={styles.author} rel="author">
                {profile.name}
              </a>
              {newTitle ? (
                <>
                  <span className={styles.sep} aria-hidden="true">
                    /
                  </span>
                  <span>{newTitle}</span>
                </>
              ) : null}
              {post.publishedAt ? (
                <>
                  <span className={styles.sep} aria-hidden="true">
                    /
                  </span>
                  <time dateTime={dateIso}>{formatBuildLogLongDate(dateIso)}</time>
                </>
              ) : (
                <>
                  <span className={styles.sep} aria-hidden="true">
                    /
                  </span>
                  <span>Draft</span>
                </>
              )}
            </div>
            {post.summary ? <p className={styles.summary}>{post.summary}</p> : null}
          </header>

          <BuildLogMarkdown markdown={post.bodyMarkdown} className={prose.prose} />
        </article>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>
            {profile.name} wrote and published this post on {BRAND_NAME}.{" "}
            <a href={profilePath} className={styles.back}>
              See {firstName}&apos;s proof page
            </a>
          </p>
          <a href="/map" className="rm-btn rm-btn--secondary">
            Find your new title
          </a>
        </div>
      </footer>

      {isPublic ? (
        <script
          type="application/ld+json"
          // JSON-LD only (not post HTML): "<" is escaped so the payload cannot close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingLd).replace(/</g, "\\u003c") }}
        />
      ) : null}
    </div>
  );
}
