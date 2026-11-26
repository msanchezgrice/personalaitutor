import { resolveLearnerRoleLabel } from "@aitutor/shared";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { SiteEditor, type SiteEditorInitial } from "@/components/proof/site-editor";
import { buildDashboardRuntimeBootstrap, getDashboardServerState } from "@/app/dashboard/_lib";
import { buildProofSiteState } from "@/lib/proof/site-api";
import { getSiteUrl } from "@/lib/site";

export const metadata = {
  title: "Proof site | Proof Studio",
  robots: { index: false, follow: false },
};

export default async function DashboardProofSitePage() {
  const state = await getDashboardServerState();
  const user = state.user;

  let initial: SiteEditorInitial | null = null;
  let loadError: string | null = null;
  if (user) {
    try {
      const siteState = await buildProofSiteState(user);
      initial = { ...siteState, siteUrl: getSiteUrl() };
    } catch (error) {
      console.error("[dashboard/proof/site] load failed", error instanceof Error ? error.message : error);
      loadError = "We could not load your proof site. Refresh the page to try again.";
    }
  }

  return (
    <DashboardShell
      activeTab="proof"
      headerTitle="Proof Studio"
      headerSubtitle="Your public site, voice model and build log."
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
      <div className="rm" style={{ minHeight: 0, background: "transparent" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px clamp(16px, 4vw, 40px) 0" }}>
          <a href="/dashboard/proof" className="rm-small" style={{ color: "var(--rm-green-deep)", fontWeight: 600 }}>
            Back to Proof Studio
          </a>
        </div>
        {initial ? (
          <SiteEditor initial={initial} />
        ) : (
          <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px clamp(16px, 4vw, 40px) 96px" }}>
            <p className="rm-alert rm-alert--error" role="alert">
              {loadError ?? "Sign in to build your proof site."}
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
