import { getCareerMapTitle, resolveLearnerRoleLabel } from "@aitutor/shared";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { buildDashboardRuntimeBootstrap, getDashboardServerState } from "@/app/dashboard/_lib";
import { loadLearnerCareerMap, loadProofStatuses } from "@/components/dashboard/route-data";
import { ProofStudioHub } from "@/components/dashboard/route-proof-hub";
import { getSiteUrl } from "@/lib/site";

function absoluteUrl(path: string | null) {
  if (!path) return null;
  try {
    return new URL(path, `${getSiteUrl()}/`).toString();
  } catch {
    return path;
  }
}

export default async function DashboardProofStudioPage() {
  const state = await getDashboardServerState();
  const user = state.user;
  const learnerProfileId = user?.id ?? null;
  const published = Boolean(user?.published);
  const [mapResult, statuses] = await Promise.all([
    loadLearnerCareerMap(learnerProfileId),
    learnerProfileId
      ? loadProofStatuses({ learnerProfileId, published })
      : Promise.resolve({ site: null, model: null, log: null }),
  ]);
  const newTitle = mapResult.status === "ok" ? getCareerMapTitle(mapResult.value.map.primary.titleId)?.title ?? null : null;

  return (
    <DashboardShell
      activeTab="proof"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-award text-emerald-400"></i> Proof Studio
        </span>
      )}
      headerSubtitle="Your site, voice model and build log, in one place."
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
        <ProofStudioHub
          statuses={statuses}
          publicUrl={published ? absoluteUrl(state.publicProfileUrl) : null}
          mapState={mapResult.status}
          newTitle={newTitle}
        />
      </div>
    </DashboardShell>
  );
}
