import React from "react";
import type {
  AdminAnalyticsBreakdownRow,
  AdminAnalyticsReport,
  AdminAnalyticsWindow,
} from "@/lib/admin-analytics";

type AdminAnalyticsPageViewProps = {
  report: AdminAnalyticsReport;
  activeWindow: AdminAnalyticsWindow;
};

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatRate(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{label}</p>
      <p className="mt-3 text-3xl font-[Outfit] text-white">{value}</p>
      {detail ? <p className="mt-2 text-sm text-gray-400">{detail}</p> : null}
    </div>
  );
}

function BreakdownTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: AdminAnalyticsBreakdownRow[];
}) {
  return (
    <div className="glass overflow-hidden rounded-2xl border border-white/10">
      <div className="border-b border-white/10 px-6 py-5">
        <h3 className="text-xl font-[Outfit] text-white">{title}</h3>
        <p className="mt-2 text-sm text-gray-400">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left">
          <thead className="bg-black/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-gray-400">
              <th className="px-4 py-4 font-medium">Segment</th>
              <th className="px-4 py-4 font-medium">Landing views</th>
              <th className="px-4 py-4 font-medium">CTA clicks</th>
              <th className="px-4 py-4 font-medium">Signups</th>
              <th className="px-4 py-4 font-medium">Onboarding viewed</th>
              <th className="px-4 py-4 font-medium">Assessment complete</th>
              <th className="px-4 py-4 font-medium">Checkout started</th>
              <th className="px-4 py-4 font-medium">Checkout completed</th>
              <th className="px-4 py-4 font-medium">Guest linked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-sm text-gray-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  No rows in this window.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td className="px-4 py-4 text-white">{row.label}</td>
                  <td className="px-4 py-4">{formatCount(row.landingViews)}</td>
                  <td className="px-4 py-4">{formatCount(row.landingCtaClicks)}</td>
                  <td className="px-4 py-4">{formatCount(row.signUpCompleted)}</td>
                  <td className="px-4 py-4">{formatCount(row.onboardingViewed)}</td>
                  <td className="px-4 py-4">{formatCount(row.assessmentCompleted)}</td>
                  <td className="px-4 py-4">{formatCount(row.checkoutStarted)}</td>
                  <td className="px-4 py-4">{formatCount(row.checkoutCompleted)}</td>
                  <td className="px-4 py-4">{formatCount(row.guestLinked)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminAnalyticsPageView({
  report,
  activeWindow,
}: AdminAnalyticsPageViewProps) {
  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.28em] text-emerald-300">Overview</p>
          <p className="mt-3 text-sm text-gray-400">
            Window <span className="font-medium text-white">{activeWindow}</span>. This report tracks the
            acquisition-to-paid funnel and whether guest visitors are getting linked to the signed-in learner record.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Landing views" value={formatCount(report.overviewTotals.landingViews)} />
          <MetricCard label="CTA clicks" value={formatCount(report.overviewTotals.landingCtaClicks)} />
          <MetricCard label="Signups completed" value={formatCount(report.overviewTotals.signUpCompleted)} />
          <MetricCard label="Onboarding viewed" value={formatCount(report.overviewTotals.onboardingViewed)} />
          <MetricCard label="Assessment completed" value={formatCount(report.overviewTotals.assessmentCompleted)} />
          <MetricCard label="Checkout started" value={formatCount(report.overviewTotals.checkoutStarted)} />
          <MetricCard label="Checkout completed" value={formatCount(report.overviewTotals.checkoutCompleted)} />
          <MetricCard label="Guest linked" value={formatCount(report.overviewTotals.guestLinked)} />
        </div>
      </section>

      <section className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.28em] text-emerald-300">Exact funnel</p>
          <p className="mt-3 text-sm text-gray-400">
            Canonical step counts for the current window, using the same visitor key through guest and signed-in states
            whenever we can resolve the link.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Landing to CTA"
            value={formatRate(report.exactFunnelTotals.landingToCtaRate)}
            detail={`${formatCount(report.exactFunnelTotals.landingCtaClicks)} of ${formatCount(report.exactFunnelTotals.landingViews)}`}
          />
          <MetricCard
            label="CTA to signup"
            value={formatRate(report.exactFunnelTotals.ctaToSignupRate)}
            detail={`${formatCount(report.exactFunnelTotals.signUpCompleted)} completed signups`}
          />
          <MetricCard
            label="Signup to onboarding"
            value={formatRate(report.exactFunnelTotals.signupToOnboardingRate)}
            detail={`${formatCount(report.exactFunnelTotals.onboardingViewed)} onboarding views`}
          />
          <MetricCard
            label="Onboarding to assessment"
            value={formatRate(report.exactFunnelTotals.onboardingToAssessmentRate)}
            detail={`${formatCount(report.exactFunnelTotals.assessmentCompleted)} completed assessments`}
          />
          <MetricCard
            label="Assessment to checkout"
            value={formatRate(report.exactFunnelTotals.assessmentToCheckoutStartedRate)}
            detail={`${formatCount(report.exactFunnelTotals.checkoutStarted)} checkout starts`}
          />
          <MetricCard
            label="Checkout completed"
            value={formatRate(report.exactFunnelTotals.checkoutStartedToCompletedRate)}
            detail={`${formatCount(report.exactFunnelTotals.checkoutCompleted)} completions`}
          />
          <MetricCard
            label="Guest linked"
            value={formatCount(report.exactFunnelTotals.guestLinked)}
            detail="Guest sessions attached to signed-in learner records"
          />
        </div>
      </section>

      <section className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.28em] text-emerald-300">Attribution coverage</p>
          <p className="mt-3 text-sm text-gray-400">
            We need UTM source, campaign, and landing path on every meaningful step so source-level funnel drop-off is
            trustworthy.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Events with utm source" value={formatCount(report.attributionCoverage.eventsWithUtmSource)} />
          <MetricCard label="Events with utm campaign" value={formatCount(report.attributionCoverage.eventsWithUtmCampaign)} />
          <MetricCard label="Events with landing path" value={formatCount(report.attributionCoverage.eventsWithLandingPath)} />
          <MetricCard label="Signups with utm source" value={formatCount(report.attributionCoverage.signUpsWithUtmSource)} />
          <MetricCard label="Checkouts with utm source" value={formatCount(report.attributionCoverage.checkoutsWithUtmSource)} />
        </div>
      </section>

      <section className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.28em] text-emerald-300">Tracked steps</p>
          <p className="mt-3 text-sm text-gray-400">
            Additional checkpoints around auth, assessment start, completion, and downstream project creation that stay
            attached to the same visitor or resolved learner profile.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Sign-up page viewed" value={formatCount(report.trackedSteps.signUpPageViewed)} />
          <MetricCard label="Sign-in completed" value={formatCount(report.trackedSteps.signInCompleted)} />
          <MetricCard label="Assessment started" value={formatCount(report.trackedSteps.assessmentStarted)} />
          <MetricCard label="Onboarding completed" value={formatCount(report.trackedSteps.onboardingCompleted)} />
          <MetricCard label="Project created" value={formatCount(report.trackedSteps.projectCreated)} />
        </div>
      </section>

      <BreakdownTable
        title="By source"
        description="Unique people by last-touch utm source."
        rows={report.sourceBreakdown}
      />
      <BreakdownTable
        title="By campaign"
        description="Unique people by utm campaign."
        rows={report.campaignBreakdown}
      />
      <BreakdownTable
        title="By landing path"
        description="Unique people by captured landing path."
        rows={report.landingPathBreakdown}
      />
    </div>
  );
}
