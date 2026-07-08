import React from "react";
import type { WeeklyFocusCardData } from "@/lib/plan-progress";

/**
 * "This week's focus" card on dashboard Home (spine phase 3). Surfaces the
 * learner's current 30-day-plan week: its focus, the week's actions, the
 * module it advances (door to the workbench), and a 4-dot week tracker.
 * A week counts as done when its module tutor session has been completed.
 *
 * Server-rendered like ReadinessScoreCard; only mounted when the learner has
 * a linked plan, so pre-spine users see no change.
 */
export function WeeklyFocusCard({ card }: { card: WeeklyFocusCardData }) {
  return (
    <section
      data-dashboard-home-section="weekly-focus"
      className="glass-panel p-6 rounded-2xl mb-8 border border-amber-500/30 overflow-hidden relative"
    >
      <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none"></div>
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
              <i className="fa-solid fa-calendar-week text-amber-400"></i> This Week&apos;s Focus
            </h2>
            <span
              data-plan-week-label="1"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300"
            >
              Week {card.currentWeek} of {card.totalWeeks}
            </span>
          </div>
          <p data-plan-week-focus="1" className="mt-2 text-sm text-gray-200 font-medium">
            {card.focus}
          </p>
          <ul className="mt-3 space-y-1.5">
            {card.actions.map((action) => (
              <li key={action} className="flex items-start gap-2 text-sm text-gray-400">
                <i className="fa-solid fa-circle-check text-amber-400/70 mt-0.5 text-xs"></i>
                <span>{action}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="/dashboard/projects/#pack-workbench"
              className="btn btn-primary text-xs px-4 py-2 whitespace-nowrap"
              data-analytics-event="dashboard_home_cta_clicked"
              data-analytics-cta="open_weekly_focus_module"
              data-analytics-location="weekly_focus_card"
              data-analytics-destination="/dashboard/projects/#pack-workbench"
            >
              {card.moduleTitle ? (
                <>
                  <i className="fa-solid fa-layer-group mr-1.5"></i> Open {card.moduleTitle}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-layer-group mr-1.5"></i> Open this week&apos;s module
                </>
              )}
            </a>
          </div>
        </div>
        <div className="shrink-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-2 lg:text-right">30-day plan</p>
          <div className="flex items-center gap-2">
            {card.weeks.map((week) => {
              const state = week.completed ? "completed" : week.isCurrent ? "current" : "upcoming";
              const dotClass =
                state === "completed"
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : state === "current"
                    ? "bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.35)]"
                    : "bg-white/5 border-white/10 text-gray-500";
              return (
                <span
                  key={week.week}
                  data-plan-week-dot={`${week.week}`}
                  data-state={state}
                  title={`Week ${week.week}${state === "completed" ? " — module completed" : state === "current" ? " — current week" : ""}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${dotClass}`}
                >
                  {state === "completed" ? <i className="fa-solid fa-check"></i> : week.week}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
