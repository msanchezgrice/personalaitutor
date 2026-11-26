import { resolveLearnerRoleLabel } from "@aitutor/shared";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { buildDashboardRuntimeBootstrap, getDashboardServerState } from "@/app/dashboard/_lib";
import { RouteCareerMapEmpty, RouteCareerMapUnavailable, RouteCareerMapView } from "@/components/dashboard/route-career-map-view";
import { loadLearnerCareerMap, loadProofStatuses } from "@/components/dashboard/route-data";

export default async function DashboardCareerMapPage() {
  const state = await getDashboardServerState();
  const user = state.user;
  const learnerProfileId = user?.id ?? null;
  const mapResult = await loadLearnerCareerMap(learnerProfileId);
  const statuses =
    mapResult.status === "ok" && learnerProfileId
      ? await loadProofStatuses({ learnerProfileId, published: Boolean(user?.published) })
      : null;

  return (
    <DashboardShell
      activeTab="map"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-route text-emerald-400"></i> Career Map
        </span>
      )}
      headerSubtitle="Your new title, the skills that carry over and the proof plan behind it."
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
        {mapResult.status === "ok" ? (
          <RouteCareerMapView value={mapResult.value} statuses={statuses} />
        ) : mapResult.status === "error" ? (
          <RouteCareerMapUnavailable />
        ) : (
          <RouteCareerMapEmpty />
        )}
      </div>
    </DashboardShell>
  );
}
