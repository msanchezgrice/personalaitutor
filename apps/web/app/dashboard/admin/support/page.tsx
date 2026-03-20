import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { buildDashboardRuntimeBootstrap, getDashboardServerState } from "@/app/dashboard/_lib";
import { SignupAuditRefreshControls } from "@/app/dashboard/admin/signups/refresh-controls";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { AdminSupportPageView } from "@/components/admin-support-page-view";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { listAdminSupportInboxRows } from "@/lib/admin-support";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function clampNumber(input: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export default async function DashboardAdminSupportPage({
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

  const days = clampNumber(readParam(params.days), 90, 7, 365);
  const limit = clampNumber(readParam(params.limit), 100, 25, 250);
  const q = readParam(params.q).trim();
  const rows = await listAdminSupportInboxRows({
    days,
    limit,
    search: q || undefined,
  });
  const refreshedAt = new Date().toISOString();

  return (
    <DashboardShell
      activeTab="activity"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-life-ring text-emerald-400"></i> Customer Service
        </span>
      )}
      headerSubtitle="A support-facing learner inbox for onboarding, billing, and message triage."
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
        <SignupAuditRefreshControls initialRefreshedAt={refreshedAt} />
      )}
      hideHeaderActionsOnMobile
      decor={<div className="absolute top-0 right-1/4 h-[260px] w-[420px] bg-emerald-500/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="mx-auto w-full max-w-7xl space-y-8 p-10 pb-24">
        <section className="glass rounded-2xl border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <AdminSectionNav active="support" />
            <form className="grid items-end gap-3 sm:grid-cols-[minmax(220px,1fr),160px,120px,auto]" method="get">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Search
                </span>
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Name, email, or handle"
                  className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Window
                </span>
                <select
                  name="days"
                  defaultValue={String(days)}
                  className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="180">Last 180 days</option>
                  <option value="365">Last 365 days</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Limit
                </span>
                <select
                  name="limit"
                  defaultValue={String(limit)}
                  className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="150">150</option>
                  <option value="250">250</option>
                </select>
              </label>
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary px-5 py-3 text-sm">
                  Apply
                </button>
                <Link href={"/dashboard/admin/support" as Route} className="btn btn-secondary px-5 py-3 text-sm">
                  Clear
                </Link>
              </div>
            </form>
          </div>
        </section>

        <section className="glass rounded-2xl border border-white/10 p-6 md:p-8">
          <AdminSupportPageView rows={rows} />
        </section>
      </div>
    </DashboardShell>
  );
}
