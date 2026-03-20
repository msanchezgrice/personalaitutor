import React from "react";
import Link from "next/link";
import type { AdminSupportInboxRow } from "@/lib/admin-support";

function formatDateTime(value: string | null) {
  if (!value) return "Not contacted yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminSupportPageView({
  rows,
  isLoading = false,
}: {
  rows: AdminSupportInboxRow[];
  isLoading?: boolean;
}) {
  return (
    <>
      <div className="max-w-4xl">
        <p className="text-sm uppercase tracking-[0.28em] text-emerald-300">Customer Service</p>
        <h2 className="mt-3 text-4xl font-[Outfit] text-white md:text-5xl">Customer Service</h2>
        <p className="mt-4 text-lg text-gray-400">
          A support inbox for real learners: source, onboarding state, billing state, recent messages, and a shortcut
          into the full signup timeline.
        </p>
      </div>

      <div className="glass mt-10 overflow-hidden rounded-2xl border border-white/10">
        <div className="border-b border-white/10 px-6 py-5">
          <h3 className="text-xl font-[Outfit] text-white">Open customer inbox</h3>
          <p className="mt-2 text-sm text-gray-400">
            Use this to triage stuck learners, identify who needs help, and jump into the existing operator history.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left">
            <thead className="bg-black/20">
              <tr className="text-xs uppercase tracking-[0.18em] text-gray-400">
                <th className="px-4 py-4 font-medium">Customer</th>
                <th className="px-4 py-4 font-medium">Source</th>
                <th className="px-4 py-4 font-medium">Onboarding</th>
                <th className="px-4 py-4 font-medium">Billing</th>
                <th className="px-4 py-4 font-medium">Projects</th>
                <th className="px-4 py-4 font-medium">Last message</th>
                <th className="px-4 py-4 font-medium">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-sm text-gray-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {isLoading ? "Loading customer inbox..." : "No customers found."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.userId}>
                    <td className="px-4 py-4">
                      <div className="text-white">{row.name}</div>
                      <div className="mt-1 text-xs text-gray-500">{row.email}</div>
                    </td>
                    <td className="px-4 py-4">{row.source}</td>
                    <td className="px-4 py-4">{row.onboardingStatus}</td>
                    <td className="px-4 py-4">{row.billingStatus}</td>
                    <td className="px-4 py-4">
                      {row.projectCount} project{row.projectCount === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-4">
                      <div>{formatDateTime(row.lastCustomerMessageAt)}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {row.latestMessagePreview || "No learner message yet."}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/dashboard/admin/signups/${row.userId}`}
                        className="text-xs font-medium text-emerald-300 transition hover:text-white"
                      >
                        History
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
