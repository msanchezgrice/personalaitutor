import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Hardening batch (2026-07-09), generalizing the /dashboard/ai-news live
 * regression fix (see ai-news-clobber-recovery.test.ts): every dashboard
 * hydrator writes into DOM nodes captured once, so React's hydration fallback
 * (mid-deploy HTML/chunk skew) could replace the route subtree AFTER the
 * write — leaving the server skeleton visible forever while the RouteHydrator
 * skip-guard (lastHydratedPath === currentPath && data-runtime-ready=1)
 * blocked all recovery.
 *
 * Fix, per hydrator: render through a re-runnable function that re-queries
 * LIVE nodes, mark the output with a data-*-rendered attribute, keep the
 * payload in memory, and recheck at 1.5s/4s via the shared
 * scheduleRouteClobberRecovery helper (telemetry:
 * dashboard_rerendered_after_clobber with a page property). Structurally, the
 * skip-guard now consults the active route's render probe and clears
 * lastHydratedPath when the output is detached.
 */

const runtimePath = path.resolve(process.cwd(), "apps/web/public/gemini-runtime.js");
const source = readFileSync(runtimePath, "utf8");

function section(startAnchor: string, endAnchor: string) {
  const start = source.indexOf(startAnchor);
  const end = source.indexOf(endAnchor);
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThan(-1);
  expect(end, `anchor not found: ${endAnchor}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("shared clobber recovery helper", () => {
  const helper = section("function scheduleRouteClobberRecovery", "function routeHydrate()");

  test("rechecks at 1.5s and 4s after render", () => {
    expect(helper).toContain("[1500, 4000]");
  });

  test("never writes a page's output after navigating away", () => {
    expect(helper).toMatch(/currentPath !== pagePath/);
  });

  test("recovery emits per-page telemetry with a page property", () => {
    expect(helper).toContain('"dashboard_rerendered_after_clobber"');
    expect(helper).toMatch(/page:\s*options\.page/);
  });

  test("recovery clears the skip-guard so full re-hydration is allowed again", () => {
    expect(helper).toContain("clearRouteHydratedGuard()");
  });

  test("the recheck is scheduled exactly once per hydration", () => {
    expect(helper).toMatch(/clobberRecheckScheduled/);
  });

  test("re-render never throws out of the timer and never touches the network", () => {
    expect(helper).toMatch(/options\.rerender\(\)/);
    expect(helper).not.toMatch(/fetch\(|getJson\(|postJson\(/);
  });
});

describe("RouteHydrator skip-guard allows re-hydration after a clobber", () => {
  const guard = section("function routeHydrate()", "window.__AITUTOR_ROUTE_HYDRATE");

  test("the guard consults the active route's render probe before skipping", () => {
    expect(guard).toContain("hydratedOutputDetached()");
    expect(guard).toContain("clearRouteHydratedGuard()");
  });

  test("clearing the guard also resets the React-side hydrated-path signal", () => {
    const clearFn = section("function clearRouteHydratedGuard", "function registerRouteRenderProbe");
    expect(clearFn).toContain("lastHydratedPath = null");
    expect(clearFn).toContain("window.__AITUTOR_LAST_HYDRATED_PATH = null");
  });

  test("the probe checks the live DOM (isConnected) for the current path only", () => {
    const probe = section("function hydratedOutputDetached", "function scheduleRouteClobberRecovery");
    expect(probe).toMatch(/lastRouteRenderProbe\.path !== currentPath/);
    const registrations = section("function registerRouteRenderProbe", "function hydratedOutputDetached");
    expect(registrations).toMatch(/isStillRendered/);
  });
});

describe("home hydrator survives React hydration clobber", () => {
  const home = section("async function hydrateDashboardHome", "async function hydrateProjectsPage");

  test("renders through a re-runnable function that re-queries live nodes", () => {
    expect(home).toContain("function renderHome()");
    expect(home).toMatch(/renderHome\(\);/);
  });

  test("rendered output carries a marker checked via isConnected", () => {
    expect(home).toContain("data-dashboard-home-rendered");
    expect(home).toMatch(/homeOutputStillRendered[\s\S]*?isConnected/);
  });

  test("async tweet/news results are kept in memory so recovery skips the network", () => {
    expect(home).toContain("homeRenderState");
    expect(home).toMatch(/homeRenderState\.tweetText\s*=/);
    expect(home).toMatch(/homeRenderState\.newsInsights\s*=/);
  });

  test("recovery is armed with the shared helper under the home page name", () => {
    expect(home).toMatch(/scheduleRouteClobberRecovery\(\{\s*page: "home"/);
    expect(home).toMatch(/rerender: renderHome/);
  });
});

describe("projects hydrator survives React hydration clobber", () => {
  const projects = section("async function hydrateProjectsPage", "function createBubble");

  test("renders through a re-runnable function from the in-memory summary", () => {
    expect(projects).toContain("function renderProjects()");
    expect(projects).toMatch(/renderProjects\(\);/);
  });

  test("rendered output carries a marker checked via isConnected", () => {
    expect(projects).toContain("data-projects-rendered");
    expect(projects).toMatch(/projectsOutputStillRendered[\s\S]*?isConnected/);
  });

  test("recovery is armed with the shared helper under the projects page name", () => {
    expect(projects).toMatch(/scheduleRouteClobberRecovery\(\{\s*page: "projects"/);
    expect(projects).toMatch(/rerender: renderProjects/);
  });
});

describe("chat hydrator survives React hydration clobber", () => {
  const chat = section("async function hydrateChatPage", "async function hydrateSocialPage");

  test("the transcript container carries a marker checked via isConnected", () => {
    expect(chat).toContain("data-chat-rendered");
    expect(chat).toMatch(/chatOutputStillRendered[\s\S]*?isConnected/);
  });

  test("recovery re-renders the in-memory transcript into the live container", () => {
    const recovery = chat.slice(chat.indexOf("function recoverChatSurface"));
    expect(recovery).toMatch(/chatHistoryState\.forEach/);
    expect(recovery).toMatch(/renderTutorSessionBanner\(/);
  });

  test("recovery re-binds the composer only when its nodes were replaced", () => {
    const recovery = chat.slice(chat.indexOf("function recoverChatSurface"));
    expect(recovery).toMatch(/composerChanged/);
    expect(recovery).toMatch(/bindChatComposer\(\)/);
  });

  test("recovery is armed with the shared helper under the chat page name", () => {
    expect(chat).toMatch(/scheduleRouteClobberRecovery\(\{\s*page: "chat"/);
    expect(chat).toMatch(/rerender: recoverChatSurface/);
  });
});

describe("social hydrator survives React hydration clobber", () => {
  const social = section("async function hydrateSocialPage", "async function hydrateUpdatesPage");

  test("renders through a re-runnable shell that re-queries the live container", () => {
    expect(social).toContain("function renderSocialShell()");
    expect(social).toMatch(/liveSocialContentWrap[\s\S]*?isConnected/);
  });

  test("rendered output carries a marker", () => {
    expect(social).toContain("data-social-rendered");
  });

  test("drafts and source label live in memory so recovery re-applies them", () => {
    expect(social).toMatch(/draftState\.sourceLabel/);
    expect(social).toMatch(/updateDraftInputs\(\)/);
  });

  test("recovery is armed with the shared helper under the social page name", () => {
    expect(social).toMatch(/scheduleRouteClobberRecovery\(\{\s*page: "social"/);
    expect(social).toMatch(/rerender: renderSocialShell/);
  });
});

describe("activity/updates hydrator survives React hydration clobber", () => {
  const updates = section("async function hydrateUpdatesPage", "async function hydrateAiNewsPage");

  test("renders through a re-runnable function into the live container", () => {
    expect(updates).toContain("function renderActivity()");
    expect(updates).toMatch(/liveUpdatesContentWrap[\s\S]*?isConnected/);
  });

  test("rendered output carries a marker", () => {
    expect(updates).toContain("data-updates-rendered");
  });

  test("recovery is armed with the shared helper under the activity page name", () => {
    expect(updates).toMatch(/scheduleRouteClobberRecovery\(\{\s*page: "activity"/);
    expect(updates).toMatch(/rerender: renderActivity/);
  });
});

describe("profile hydrator survives React hydration clobber", () => {
  const profile = section("async function hydrateProfilePage", "function buildTalentCardElement");

  test("renders through a re-runnable function that re-queries the live form", () => {
    expect(profile).toContain("function renderProfile()");
    expect(profile).toMatch(/renderProfile\(\);/);
  });

  test("the form carries a marker checked via isConnected", () => {
    expect(profile).toContain("data-profile-rendered");
    expect(profile).toMatch(/profileOutputStillRendered[\s\S]*?isConnected/);
  });

  test("recovery is armed with the shared helper under the profile page name", () => {
    expect(profile).toMatch(/scheduleRouteClobberRecovery\(\{\s*page: "profile"/);
    expect(profile).toMatch(/rerender: renderProfile/);
  });
});

describe("ai-news hydrator participates in the skip-guard probe", () => {
  const aiNews = section("async function hydrateAiNewsPage", "async function hydrateProfilePage");

  test("registers its render probe so the skip-guard can detect its clobber", () => {
    expect(aiNews).toMatch(/registerRouteRenderProbe\("\/dashboard\/ai-news"/);
  });

  test("its recovery clears the skip-guard like the shared helper does", () => {
    expect(aiNews).toContain("clearRouteHydratedGuard()");
  });
});
