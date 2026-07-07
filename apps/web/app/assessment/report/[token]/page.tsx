import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCareerPath } from "@aitutor/shared";
import { AssessmentReportTracking } from "@/components/assessment-report-tracking";
import {
  findAnonymousAssessmentByToken,
  getLatestAssessmentReport,
  listAssessmentReports,
} from "@/lib/anonymous-assessment";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Your AI-Readiness Report`,
  description: "Your personalized AI skill-gap report and 0-100 AI-readiness score.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

const impactStyles: Record<string, { label: string; className: string }> = {
  high: { label: "High impact", className: "border-red-400/40 bg-red-500/10 text-red-300" },
  medium: { label: "Medium impact", className: "border-amber-400/40 bg-amber-500/10 text-amber-300" },
  low: { label: "Low impact", className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" },
};

function scoreBand(score: number) {
  if (score >= 70) return { label: "AI-Ready", color: "#10b981" };
  if (score >= 45) return { label: "Building", color: "#f59e0b" };
  return { label: "At Risk", color: "#ef4444" };
}

export default async function AssessmentReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const assessment = await findAnonymousAssessmentByToken(decodeURIComponent(token));
  if (!assessment) notFound();

  const latest = await getLatestAssessmentReport(assessment.id);
  if (!latest) notFound();

  const history = await listAssessmentReports(assessment.id);
  const report = latest.report;
  const score = latest.readinessScore;
  const band = scoreBand(score);
  const recommendedPath = getCareerPath(report.recommendedPath.careerPathId);

  return (
    <div className="relative min-h-screen bg-[#0b0f19] text-gray-200 overflow-x-hidden px-4 py-10 md:px-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{ background: "radial-gradient(ellipse at top, rgba(16,185,129,0.14), transparent 60%)" }}
      />
      <AssessmentReportTracking
        anonymousAssessmentId={assessment.id}
        score={score}
        careerPathId={report.recommendedPath.careerPathId}
        emailCaptured={Boolean(assessment.emailCapturedAt)}
      />

      <div className="relative max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <a href="/" className="inline-flex items-center gap-3 mb-3">
            <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-10 w-10 object-contain" />
            <span className="font-[Outfit] font-bold text-3xl tracking-tight text-white">My AI Skill Tutor</span>
          </a>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
            AI-Readiness Report
          </div>
        </div>

        {/* Score hero */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10 shadow-2xl backdrop-blur mb-8">
          <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
            <div className="mx-auto relative h-44 w-44">
              <div
                className="h-full w-full rounded-full"
                style={{ background: `conic-gradient(${band.color} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
              />
              <div className="absolute inset-3.5 rounded-full bg-[#0d1322] flex flex-col items-center justify-center">
                <span className="text-6xl font-bold" style={{ color: band.color }}>
                  {score}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mt-1">
                  out of 100
                </span>
              </div>
            </div>
            <div className="text-center md:text-left">
              <span
                className="inline-block rounded-full border px-3 py-1 text-xs font-semibold mb-4"
                style={{ borderColor: `${band.color}66`, backgroundColor: `${band.color}1a`, color: band.color }}
              >
                {band.label}
              </span>
              <h1 className="text-2xl md:text-3xl font-[Outfit] font-semibold text-white leading-snug mb-3">
                {report.headline}
              </h1>
              <p className="text-sm leading-7 text-gray-300">{report.summary}</p>
              {assessment.careerCategoryLabel || assessment.jobTitle ? (
                <p className="mt-3 text-xs text-gray-500">
                  Scored for: {assessment.jobTitle || assessment.careerCategoryLabel}
                  {assessment.yearsExperience ? ` · ${assessment.yearsExperience} yrs` : ""}
                </p>
              ) : null}
            </div>
          </div>

          {history.length > 1 ? (
            <div className="mt-8 border-t border-white/10 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 mb-3">Score history</p>
              <div className="flex flex-wrap items-center gap-2">
                {history.map((entry, index) => (
                  <span key={entry.id} className="inline-flex items-center gap-2 text-sm text-gray-300">
                    {index > 0 ? <span className="text-gray-600">→</span> : null}
                    <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-semibold text-white">
                      {entry.readinessScore}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Strengths */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-[Outfit] text-white mb-4">
              <span className="text-emerald-400 mr-2">▲</span>Your Strengths
            </h2>
            <ul className="space-y-4">
              {report.strengths.map((strength) => (
                <li key={strength.title}>
                  <p className="font-semibold text-white text-sm">{strength.title}</p>
                  <p className="text-sm leading-6 text-gray-400">{strength.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Gaps */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-[Outfit] text-white mb-4">
              <span className="text-red-400 mr-2">▼</span>Gaps, Ranked by Market Impact
            </h2>
            <ul className="space-y-4">
              {report.gaps.map((gap, index) => {
                const impact = impactStyles[gap.marketImpact] ?? impactStyles.medium;
                return (
                  <li key={gap.title}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-white text-sm">
                        {index + 1}. {gap.title}
                      </p>
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${impact.className}`}>
                        {impact.label}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-gray-400 mt-1">{gap.whyItMatters}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Recommended path */}
        {recommendedPath ? (
          <section className="rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6 md:p-8 mb-8">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
              Recommended Path
            </div>
            <h2 className="text-2xl font-[Outfit] text-white mb-2">{recommendedPath.name}</h2>
            <p className="text-sm leading-7 text-gray-300 mb-4">{report.recommendedPath.reason}</p>
            <div className="flex flex-wrap gap-2">
              {recommendedPath.modules.map((module) => (
                <span key={module} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                  {module}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {/* 30-day plan */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 mb-10">
          <h2 className="text-2xl font-[Outfit] text-white mb-6">Your 30-Day Plan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {report.thirtyDayPlan.map((week) => (
              <div key={week.week} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400 mb-1.5">
                  Week {week.week}
                </p>
                <p className="font-semibold text-white text-sm mb-2">{week.focus}</p>
                <ul className="space-y-1.5">
                  {week.actions.map((action) => (
                    <li key={action} className="flex items-start gap-2 text-sm leading-6 text-gray-400">
                      <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center pb-10">
          <h3 className="text-2xl font-[Outfit] text-white mb-3">This score can move.</h3>
          <p className="text-sm text-gray-400 max-w-lg mx-auto mb-6">
            Create a free account to save your score, track it over time, and get a tutor that closes one gap per
            week — with proof you can show.
          </p>
          <a
            href="/sign-up?redirect_url=/dashboard/"
            className="inline-block rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-400"
          >
            Start Raising Your Score →
          </a>
          <p className="mt-4 text-xs text-gray-600">
            Report generated {new Date(latest.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · {BRAND_NAME}
          </p>
        </section>
      </div>
    </div>
  );
}
