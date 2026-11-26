import type { Metadata } from "next";
import { resolveLearnerRoleLabel } from "@aitutor/shared";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { buildDashboardRuntimeBootstrap, getDashboardServerState } from "@/app/dashboard/_lib";
import { BuildLogStudio, type BuildLogStudioPost } from "@/components/proof/build-log-studio";
import { buildLogPostPath } from "@/lib/build-log/access";
import { getBuildLogMapContext } from "@/lib/build-log/context";
import { listBuildLogPosts } from "@/lib/build-log/store";
import { getSiteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Build log | Proof Studio",
  robots: { index: false, follow: false },
};

export default async function DashboardBuildLogPage() {
  const state = await getDashboardServerState();
  const user = state.user;

  let posts: BuildLogStudioPost[] = [];
  let loadError: string | null = null;
  let suggestion: { title: string; summary: string | null; newTitle: string | null } | null = null;
  if (user) {
    try {
      const [stored, context] = await Promise.all([listBuildLogPosts(user.id), getBuildLogMapContext(user.id)]);
      posts = stored.map((post) => ({ ...post, path: buildLogPostPath(user.handle, post.slug) }));
      suggestion = context?.firstPostTitle
        ? { title: context.firstPostTitle, summary: context.firstPostSummary, newTitle: context.newTitle }
        : null;
    } catch {
      loadError = "We could not load your posts. Refresh the page to try again.";
    }
  }

  return (
    <DashboardShell
      activeTab="proof"
      headerTitle="Build log"
      headerSubtitle="Short public posts about what you built. Part of Proof Studio."
      operatorToolsHref={state.operatorToolsUrl}
      billingPortalEnabled={Boolean(state.billing.subscription)}
      runtimeBootstrap={buildDashboardRuntimeBootstrap(state)}
      initialUser={{
        name: user?.name ?? state.seed?.name ?? "Learner",
        headline: resolveLearnerRoleLabel({ headline: user?.headline, careerPathId: user?.careerPathId }),
        avatarUrl: user?.avatarUrl ?? state.seed?.avatarUrl ?? null,
        publicProfileUrl: state.publicProfileUrl,
        levelLabel: state.sidebarLevel.label,
        levelSubtitle: state.sidebarLevel.subtitle,
        levelProgressPct: state.sidebarLevel.progressPct,
        levelProgressText: state.sidebarLevel.progressText,
      }}
    >
      <div className="rm" style={{ minHeight: 0, background: "transparent", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px clamp(16px, 3vw, 40px) 96px" }}>
          <p className="rm-small" style={{ marginBottom: 16 }}>
            <a href="/dashboard/proof">Proof Studio</a> <span aria-hidden="true">/</span> Build log
          </p>
          {!user ? (
            <p className="rm-alert rm-alert--error">Sign in to write your build log.</p>
          ) : loadError ? (
            <p className="rm-alert rm-alert--error" role="alert">
              {loadError}
            </p>
          ) : (
            <BuildLogStudio
              initialPosts={posts}
              profile={{ handle: user.handle, name: user.name, published: user.published }}
              suggestion={suggestion}
              siteUrl={getSiteUrl()}
            />
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
