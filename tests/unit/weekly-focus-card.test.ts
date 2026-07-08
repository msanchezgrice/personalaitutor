import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
// eslint-disable-next-line import/no-relative-packages -- matches existing test convention
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { createElement } from "react";
import { WeeklyFocusCard } from "../../apps/web/components/weekly-focus-card";
import type { WeeklyFocusCardData } from "../../apps/web/lib/plan-progress";

const CARD: WeeklyFocusCardData = {
  currentWeek: 2,
  totalWeeks: 4,
  focus: "Synthetic user research reps",
  actions: ["Run one AI-led synthesis", "Summarize three interviews"],
  moduleTitle: "Synthetic User Research",
  weeks: [
    { week: 1, completed: true, isCurrent: false },
    { week: 2, completed: false, isCurrent: true },
    { week: 3, completed: false, isCurrent: false },
    { week: 4, completed: false, isCurrent: false },
  ],
};

describe("WeeklyFocusCard component (spine phase 3)", () => {
  test("renders the current week, focus, actions, and module link", () => {
    const html = renderToStaticMarkup(createElement(WeeklyFocusCard, { card: CARD }));
    expect(html).toContain("This Week&#x27;s Focus");
    expect(html).toContain("Week 2 of 4");
    expect(html).toContain("Synthetic user research reps");
    expect(html).toContain("Run one AI-led synthesis");
    expect(html).toContain("Summarize three interviews");
    expect(html).toContain("Synthetic User Research");
    expect(html).toContain('href="/dashboard/projects/#pack-workbench"');
    expect(html).toContain('data-dashboard-home-section="weekly-focus"');
  });

  test("renders a 4-dot week tracker with completed/current/upcoming states", () => {
    const html = renderToStaticMarkup(createElement(WeeklyFocusCard, { card: CARD }));
    const dotStates = Array.from(html.matchAll(/data-plan-week-dot="(\d)" data-state="(\w+)"/g)).map(
      (match) => [match[1], match[2]],
    );
    expect(dotStates).toEqual([
      ["1", "completed"],
      ["2", "current"],
      ["3", "upcoming"],
      ["4", "upcoming"],
    ]);
  });

  test("legacy plans without a moduleTitle render without a module row", () => {
    const html = renderToStaticMarkup(
      createElement(WeeklyFocusCard, { card: { ...CARD, moduleTitle: null } }),
    );
    expect(html).toContain("Week 2 of 4");
    expect(html).not.toContain("Synthetic User Research");
    expect(html).toContain('href="/dashboard/projects/#pack-workbench"');
  });
});

describe("dashboard home mounts the weekly focus card", () => {
  test("card renders between the readiness score card and the daily-action card", () => {
    const source = readFileSync(path.resolve(process.cwd(), "apps/web/app/dashboard/page.tsx"), "utf8");
    expect(source).toContain("getWeeklyFocusCard");
    const readinessIndex = source.indexOf("<ReadinessScoreCard");
    const weeklyIndex = source.indexOf("<WeeklyFocusCard");
    const dailyActionIndex = source.indexOf("<DailyActionCard");
    expect(weeklyIndex).toBeGreaterThan(readinessIndex);
    expect(weeklyIndex).toBeLessThan(dailyActionIndex);
  });
});
