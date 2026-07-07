"use client";

import { useState } from "react";

/**
 * "Today, 15 min: ..." card (rebuild Phase 3.3/3.5). Server-rendered with the
 * stored daily action + streak; generation and completion go through
 * /api/daily-action. A failed generation shows the explicit error — there is
 * no fabricated fallback action.
 */

export type DailyActionView = {
  title: string;
  minutes: number;
  gapRef: string;
  artifactRef: string | null;
  status: "pending" | "completed";
  scoreDelta: number;
  scoreDeltaReason: string | null;
};

export type StreakView = {
  current: number;
  longest: number;
};

export function DailyActionCard(props: {
  initialAction: DailyActionView | null;
  initialStreak: StreakView;
}) {
  const [action, setAction] = useState<DailyActionView | null>(props.initialAction);
  const [streak, setStreak] = useState<StreakView>(props.initialStreak);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateAction() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/daily-action", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        const failureCode = payload?.error?.failureCode ?? payload?.error?.code ?? `HTTP_${response.status}`;
        setError(
          failureCode === "ASSESSMENT_REPORT_MISSING"
            ? "Finish your assessment first — the daily action is scored against your report."
            : `Daily action generation failed (${failureCode}). Try again shortly.`,
        );
        return;
      }
      const data = payload.data ?? payload;
      setAction(data.action ?? null);
      if (data.streak) setStreak(data.streak);
    } catch {
      setError("Daily action generation failed. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  async function completeAction() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/daily-action/complete", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError("Could not record the check-in. Try again.");
        return;
      }
      const data = payload.data ?? payload;
      setAction((current) => (current ? { ...current, status: "completed" } : current));
      if (data.streak) setStreak(data.streak);
    } catch {
      setError("Could not record the check-in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      data-dashboard-home-section="daily-action"
      className="glass-panel p-6 rounded-2xl mb-8 border border-sky-500/30"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
              <i className="fa-solid fa-bolt text-sky-400"></i> Today&apos;s Action
            </h2>
            <span
              className="text-xs font-semibold text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1"
              data-streak-current={streak.current}
            >
              <i className="fa-solid fa-fire mr-1"></i>
              {streak.current > 0
                ? `${streak.current}-day streak`
                : streak.longest > 0
                  ? `Streak paused (best ${streak.longest})`
                  : "Start your streak"}
            </span>
          </div>

          {action ? (
            <div className="mt-3">
              <p className="text-white text-sm">
                <span className="text-sky-300 font-semibold">Today, {action.minutes} min:</span> {action.title}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Closes gap: <span className="text-gray-300">{action.gapRef}</span>
                {action.artifactRef ? (
                  <>
                    {" "}· counts toward <span className="text-gray-300">{action.artifactRef}</span>
                  </>
                ) : null}
                {action.scoreDelta !== 0 && action.scoreDeltaReason ? (
                  <>
                    {" "}· score {action.scoreDelta > 0 ? "+" : ""}
                    {action.scoreDelta}: {action.scoreDeltaReason}
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400">
              Your daily action is derived from today&apos;s AI landscape briefing and your skill-gap report.
            </p>
          )}

          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        </div>

        <div className="shrink-0">
          {action ? (
            action.status === "completed" ? (
              <span className="inline-flex items-center gap-2 text-emerald-300 text-sm font-semibold">
                <i className="fa-solid fa-circle-check"></i> Done today
              </span>
            ) : (
              <button
                type="button"
                onClick={completeAction}
                disabled={busy}
                className="btn btn-primary whitespace-nowrap disabled:opacity-50"
                data-analytics-event="daily_action_completed_clicked"
                data-analytics-location="dashboard_home"
              >
                {busy ? "Saving..." : "Mark Done"}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={generateAction}
              disabled={busy}
              className="btn btn-primary whitespace-nowrap disabled:opacity-50"
              data-analytics-event="daily_action_generate_clicked"
              data-analytics-location="dashboard_home"
            >
              {busy ? "Generating..." : "Get Today's Action"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
