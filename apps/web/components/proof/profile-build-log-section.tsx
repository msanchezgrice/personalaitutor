import React from "react";
import type { BuildLogPostPublic } from "@aitutor/shared";
import { listPublishedBuildLogPosts } from "@/lib/build-log/store";
import { buildLogDateLabel } from "@/lib/build-log/format";
import styles from "./build-log-section.module.css";

/**
 * The "Build log" list on the public proof page (/u/{handle}): date and title
 * per post, newest first, each linking to /u/{handle}/log/{slug}. Returns null
 * when the learner has no published posts (or the store is unavailable), so
 * the page simply leaves the section out.
 */
export async function ProfileBuildLogSection(props: { learnerProfileId: string; handle: string; displayName: string }) {
  let posts: BuildLogPostPublic[] = [];
  try {
    posts = await listPublishedBuildLogPosts(props.learnerProfileId);
  } catch {
    return null;
  }
  if (!posts.some((post) => post.publishedAt)) return null;
  return <BuildLogSectionView posts={posts} handle={props.handle} displayName={props.displayName} />;
}

/** Pure view, exported for tests and for static example profiles. */
export function BuildLogSectionView({
  posts,
  handle,
  displayName,
  headingId = "build-log",
}: {
  posts: Array<Pick<BuildLogPostPublic, "slug" | "title" | "publishedAt">>;
  handle: string;
  displayName: string;
  headingId?: string;
}) {
  const published = posts.filter((post) => post.publishedAt);
  if (published.length === 0) return null;
  const sorted = [...published].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const firstPublishedAt = sorted[sorted.length - 1].publishedAt;
  return (
    <section className={styles.section} aria-labelledby={headingId} data-testid="profile-build-log">
      <h2 id={headingId} className="rm-h3" style={{ fontWeight: 700, fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
        Build log
        <span className="rm-sr-only"> by {displayName}</span>
      </h2>
      <ul className={styles.list}>
        {sorted.map((post) => (
          <li key={post.slug} className={styles.item}>
            <a className={styles.link} href={`/u/${encodeURIComponent(handle)}/log/${encodeURIComponent(post.slug)}`}>
              <span className={styles.date}>{buildLogDateLabel(post.publishedAt, firstPublishedAt)}</span>
              <span className={styles.title}>{post.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
