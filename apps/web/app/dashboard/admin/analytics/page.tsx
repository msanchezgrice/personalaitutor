import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { buildDashboardRuntimeBootstrap, getDashboardServerState } from "@/app/dashboard/_lib";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { AdminAnalyticsPageView } from "@/components/admin-analytics-page-view";
import { AdminSectionNav } from "@/components/admin-section-nav";
import {
  getAdminAnalyticsReport,
  resolveAdminAnalyticsWindow,
} from "@/lib/admin-analytics";
import { SignupAuditRefreshControls } from "@/app/dashboard/admin/signups/refresh-controls";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function DashboardAdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const state = await getDashboardServerState();

  if (!state.seed?.userId) {
    redirect("/sign-in" as Route);
  }
  if (!state.isAdmin) {
    notFound();
  }

  const activeWindow = resolveAdminAnalyticsWindow(readParam(params.window));
  const report = await getAdminAnalyticsReport(activeWindow);
  const refreshedAt = new Date().toISOString();

  return (
    <DashboardShell
      activeTab="activity"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-filter-circle-dollar text-emerald-400"></i> Funnel Analytics
        </span>
      )}
      headerSubtitle="Growth funnel visibility with guest-to-user linking and attribution coverage."
      operatorToolsHref={state.operatorToolsUrl}
      billingPortalEnabled={Boolean(state.billing.subscription)}
      runtimeBootstrap={buildDashboardRuntimeBootstrap(state)}
      initialUser={{
        name: state.user?.name ?? state.seed?.name ?? "Operator",
        headline: state.user?.headline ?? "Operator",
        avatarUrl: state.user?.avatarUrl ?? state.seed?.avatarUrl ?? null,
        publicProfileUrl: state.publicProfileUrl,
        levelLabel: "Operator",
        levelSubtitle: "Growth + support console",
        levelProgressPct: 100,
        levelProgressText: "Access granted",
      }}
      headerActions={(
        <div className="flex flex-wrap items-center justify-end gap-3">
          <SignupAuditRefreshControls initialRefreshedAt={refreshedAt} />
          <a
            href="https://us.posthog.com/project/330799/dashboard"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary px-4 py-2 text-xs"
          >
            <i className="fa-solid fa-arrow-up-right-from-square mr-2"></i>Open PostHog
          </a>
        </div>
      )}
      hideHeaderActionsOnMobile
      decor={<div className="absolute top-0 right-1/4 h-[260px] w-[420px] bg-emerald-500/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="mx-auto w-full max-w-7xl space-y-8 p-10 pb-24">
        <section className="glass rounded-2xl border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <AdminSectionNav active="analytics" />
            <form className="flex items-center gap-3" method="get">
              <select
                name="window"
                defaultValue={activeWindow}
                className="rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="1d">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <button type="submit" className="btn btn-primary px-5 py-3 text-sm">
                Apply
              </button>
              <Link href={"/dashboard/admin/analytics" as Route} className="btn btn-secondary px-5 py-3 text-sm">
                Clear
              </Link>
            </form>
          </div>
        </section>

        <section className="glass rounded-2xl border border-white/10 p-6 md:p-8">
          <AdminAnalyticsPageView report={report} activeWindow={activeWindow} />
        </section>
      </div>
    </DashboardShell>
  );
}
