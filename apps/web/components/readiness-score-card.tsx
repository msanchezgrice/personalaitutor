import React from "react";
import type { ReadinessScoreCardData } from "@/lib/readiness-score";

/**
 * AI-readiness score card on dashboard Home (rebuild dashboard batch item 1).
 * The 0-100 score is the product's spine: this card shows the living number,
 * its movement vs the previous history entry, and the door to the full
 * report. Users without a linked assessment get the score CTA instead.
 *
 * Server-rendered (no client hooks); matches the Gemini shell's glass-panel
 * visual language.
 */
export function ReadinessScoreCard({ card }: { card: ReadinessScoreCardData }) {
  if (!card.hasReport) {
    return (
      <section
        data-dashboard-home-section="readiness"
        className="glass-panel p-6 rounded-2xl mb-8 border border-emerald-500/30 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
            <i className="fa-solid fa-gauge-high text-emerald-400"></i> Get your AI-readiness score
          </h2>
          <p className="mt-2 text-sm text-gray-400 max-w-2xl">
            Take the free assessment to get your 0-100 AI-readiness score for your role — every module, daily action,
            and artifact you finish here moves it.
          </p>
        </div>
        <div className="shrink-0">
          <a
            href="/assessment"
            className="btn btn-primary whitespace-nowrap"
            data-analytics-event="dashboard_home_cta_clicked"
            data-analytics-cta="start_readiness_assessment"
            data-analytics-location="readiness_card"
            data-analytics-destination="/assessment"
          >
            Get My Score
          </a>
        </div>
      </section>
    );
  }

  const delta = card.delta;
  const deltaTone =
    delta === null || delta === 0
      ? "border-white/10 bg-white/5 text-gray-300"
      : delta > 0
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : "border-rose-500/30 bg-rose-500/10 text-rose-300";
  const deltaLabel =
    delta === null ? "First score" : delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta} vs last update`;
  const deltaIcon = delta === null || delta === 0 ? "fa-minus" : delta > 0 ? "fa-arrow-trend-up" : "fa-arrow-trend-down";

  return (
    <section
      data-dashboard-home-section="readiness"
      className="glass-panel p-6 rounded-2xl mb-8 border border-emerald-500/30 overflow-hidden relative"
    >
      <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>
      <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0 w-20 h-20 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 flex flex-col items-center justify-center">
            <span data-readiness-score="1" className="text-3xl font-[Outfit] font-semibold text-white leading-none">
              {card.score}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-300/80 mt-1">/ 100</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
                <i className="fa-solid fa-gauge-high text-emerald-400"></i> AI-Readiness Score
              </h2>
              <span
                data-readiness-delta="1"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${deltaTone}`}
              >
                <i className={`fa-solid ${deltaIcon}`}></i> {deltaLabel}
              </span>
            </div>
            <p data-readiness-headline="1" className="mt-2 text-sm text-gray-300 line-clamp-2">
              {card.headline}
            </p>
          </div>
        </div>
        {card.reportUrl ? (
          <div className="shrink-0">
            <a
              href={card.reportUrl}
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
              data-analytics-event="dashboard_home_cta_clicked"
              data-analytics-cta="view_full_readiness_report"
              data-analytics-location="readiness_card"
              data-analytics-destination={card.reportUrl}
            >
              View full report <i className="fa-solid fa-arrow-right ml-1"></i>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
