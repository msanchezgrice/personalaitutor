import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { EXAMPLE_CAREER_MAP, VOICE_MODEL_METHOD_LABEL, type CareerMapRecord } from "@aitutor/shared";

const { mockLatestMap, mockSiteStatus, mockModelStatus, mockLogStatus } = vi.hoisted(() => ({
  mockLatestMap: vi.fn(),
  mockSiteStatus: vi.fn(),
  mockModelStatus: vi.fn(),
  mockLogStatus: vi.fn(),
}));

vi.mock("@/lib/career-map/store", () => ({ getLatestCareerMapForProfile: mockLatestMap }));
vi.mock("@/lib/proof/site-store", () => ({ getProofSiteStatus: mockSiteStatus }));
vi.mock("@/lib/voice-model/store", () => ({ getVoiceModelStatus: mockModelStatus }));
vi.mock("@/lib/build-log/store", () => ({ getBuildLogStatus: mockLogStatus }));

import {
  RouteCareerMapEmpty,
  RouteCareerMapUnavailable,
  RouteCareerMapView,
} from "../../apps/web/components/dashboard/route-career-map-view";
import { ProofStudioHub } from "../../apps/web/components/dashboard/route-proof-hub";
import { YourRouteCard } from "../../apps/web/components/dashboard/route-card";
import { loadLearnerCareerMap, loadProofStatuses, loadYourRouteCard } from "../../apps/web/components/dashboard/route-data";
import { pickNextProofStep, type ProofStatuses } from "../../apps/web/components/dashboard/route-pieces";

// Vitest compiles JSX with the classic runtime; the foundation remap components
// (RouteMap, TranslationList) do not import React themselves.
(globalThis as { React?: typeof React }).React = React;

const read = (relative: string) => readFileSync(path.resolve(process.cwd(), relative), "utf8");

function record(overrides: Partial<CareerMapRecord> = {}): CareerMapRecord {
  return {
    id: "map_1",
    token: "tok_example",
    status: "completed",
    source: "paste",
    inputText: "résumé",
    map: EXAMPLE_CAREER_MAP,
    model: "test",
    failureReason: null,
    email: null,
    emailCapturedAt: null,
    mapEmailSentAt: null,
    learnerProfileId: "profile_1",
    linkedAt: "2026-11-25T12:00:00.000Z",
    visitorId: null,
    ipHash: null,
    createdAt: "2026-11-25T12:00:00.000Z",
    updatedAt: "2026-11-25T12:00:00.000Z",
    ...overrides,
  };
}

const value = { token: "tok_example", map: EXAMPLE_CAREER_MAP, createdAt: "2026-11-25T12:00:00.000Z" };
const allEmpty: ProofStatuses = {
  site: { state: "empty", summary: "No site yet." },
  model: { state: "empty", summary: "Add 5 writing samples to tune it." },
  log: { state: "empty", summary: "No posts yet." },
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  mockLatestMap.mockReset();
  mockSiteStatus.mockReset();
  mockModelStatus.mockReset();
  mockLogStatus.mockReset();
});

describe("/dashboard/map view", () => {
  test("renders the new title, fit, route map, translations with quotes, alternates and gaps", () => {
    const html = renderToStaticMarkup(createElement(RouteCareerMapView, { value, statuses: allEmpty }));
    expect(html).toContain("Your new title:");
    expect(html).toContain("Go-to-Market Engineer");
    expect(html).toContain("Strong match");
    expect(html).toContain("Backed by 4 lines of your résumé");
    expect(html).toContain("rm-routemap");
    expect(html).toContain("“Planned 4 global game launches”");
    expect(html).toContain("Builds AI launch workflows");
    expect(html).toContain("A launch plan is a sequence of briefs, assets and approvals.");
    expect(html).toContain("Lifecycle Automation Lead");
    expect(html).toContain("AI Content Strategist");
    expect(html).toContain("A workflow that runs without you, built in an automation tool");
    expect(html).toContain("starting hypothesis");
    expect(html).toContain("not a hiring prediction");
  });

  test("the proof plan is three steps linking into Proof Studio, plus the shareable map link", () => {
    const html = renderToStaticMarkup(createElement(RouteCareerMapView, { value, statuses: allEmpty }));
    expect(html).toContain('href="/dashboard/proof/site"');
    expect(html).toContain('href="/dashboard/proof/model"');
    expect(html).toContain('href="/dashboard/proof/log"');
    expect(html).toContain("1. Site");
    expect(html).toContain("2. Voice model");
    expect(html).toContain("3. Build log");
    expect(html).toContain("maya-voice, tuned on your launch emails");
    expect(html).toContain("“I turned our launch checklist into one agent workflow”");
    expect(html).toContain('href="/map/tok_example"');
    expect(html).toContain("Copy link");
  });

  test("renders without statuses (no chips) and with a live piece", () => {
    const plain = renderToStaticMarkup(createElement(RouteCareerMapView, { value, statuses: null }));
    expect(plain).not.toContain("Not started");
    expect(plain).toContain("Build your site");
    const live = renderToStaticMarkup(
      createElement(RouteCareerMapView, { value, statuses: { ...allEmpty, site: { state: "live", summary: "Published" } } }),
    );
    expect(live).toContain("Live");
    expect(live).toContain("Edit your site");
  });

  test("empty state explains the map and links to /map", () => {
    const html = renderToStaticMarkup(createElement(RouteCareerMapEmpty));
    expect(html).toContain("You don&#x27;t have a career map yet");
    expect(html).toContain('href="/map"');
    expect(html).toContain("Draw your career map");
  });

  test("unavailable state is an honest error, not placeholder content", () => {
    const html = renderToStaticMarkup(createElement(RouteCareerMapUnavailable));
    expect(html).toContain("couldn&#x27;t load your career map");
    expect(html).not.toContain("Go-to-Market Engineer");
  });

  test("the page mounts inside DashboardShell activeTab=map with the rm wrapper and no seed marker", () => {
    const source = read("apps/web/app/dashboard/map/page.tsx");
    expect(source).not.toContain("FOUNDATION-SEED");
    expect(source).toContain('activeTab="map"');
    expect(source).toContain('<div className="rm" style={{ minHeight: 0, background: "transparent" }}>');
    expect(source).toContain("loadLearnerCareerMap");
  });
});

describe("career map loader", () => {
  test("returns the latest completed map", async () => {
    mockLatestMap.mockResolvedValue(record());
    await expect(loadLearnerCareerMap("profile_1")).resolves.toEqual({ status: "ok", value });
    expect(mockLatestMap).toHaveBeenCalledWith("profile_1");
  });

  test("none when there is no profile, no map, or an unfinished map", async () => {
    await expect(loadLearnerCareerMap(null)).resolves.toEqual({ status: "none" });
    expect(mockLatestMap).not.toHaveBeenCalled();
    mockLatestMap.mockResolvedValue(null);
    await expect(loadLearnerCareerMap("profile_1")).resolves.toEqual({ status: "none" });
    mockLatestMap.mockResolvedValue(record({ status: "generating", map: null }));
    await expect(loadLearnerCareerMap("profile_1")).resolves.toEqual({ status: "none" });
  });

  test("a failing store is an error result, never a throw", async () => {
    mockLatestMap.mockRejectedValue(new Error("down"));
    await expect(loadLearnerCareerMap("profile_1")).resolves.toEqual({ status: "error" });
  });
});

describe("Proof Studio hub", () => {
  test("each status call is isolated: one failing piece shows Status unavailable, the others still render", async () => {
    mockSiteStatus.mockResolvedValue({ state: "live", summary: "Your site is live." });
    mockModelStatus.mockRejectedValue(new Error("FOUNDATION_SEED_NOT_IMPLEMENTED:voice-model/store.getVoiceModelStatus"));
    mockLogStatus.mockResolvedValue({ state: "draft", summary: "1 draft, 0 published." });

    const statuses = await loadProofStatuses({ learnerProfileId: "profile_1", published: true });
    expect(mockSiteStatus).toHaveBeenCalledWith({ learnerProfileId: "profile_1", published: true });
    expect(mockModelStatus).toHaveBeenCalledWith("profile_1");
    expect(mockLogStatus).toHaveBeenCalledWith("profile_1");
    expect(statuses).toEqual({
      site: { state: "live", summary: "Your site is live." },
      model: null,
      log: { state: "draft", summary: "1 draft, 0 published." },
    });

    const html = renderToStaticMarkup(createElement(ProofStudioHub, { statuses, publicUrl: "https://www.myaiskilltutor.com/u/maya/", mapState: "ok", newTitle: "Go-to-Market Engineer" }));
    expect(html).toContain("Proof Studio");
    expect(html).toContain("Status unavailable");
    expect(html).toContain("Your site is live.");
    expect(html).toContain("1 draft, 0 published.");
    expect(html).toContain(">Live<");
    expect(html).toContain(">Draft<");
    expect(html).toContain('href="/dashboard/proof/site"');
    expect(html).toContain('href="/dashboard/proof/model"');
    expect(html).toContain('href="/dashboard/proof/log"');
  });

  test("synchronous throws and malformed statuses are isolated too", async () => {
    mockSiteStatus.mockImplementation(() => {
      throw new Error("sync");
    });
    mockModelStatus.mockResolvedValue({ state: "weird", summary: "?" });
    mockLogStatus.mockResolvedValue(null);
    await expect(loadProofStatuses({ learnerProfileId: "profile_1", published: false })).resolves.toEqual({ site: null, model: null, log: null });
  });

  test("shows the public page URL with a copy button when published", () => {
    const html = renderToStaticMarkup(createElement(ProofStudioHub, { statuses: allEmpty, publicUrl: "https://www.myaiskilltutor.com/u/maya/", mapState: "ok" }));
    expect(html).toContain('href="https://www.myaiskilltutor.com/u/maya/"');
    expect(html).toContain("Published");
    expect(html).toContain("Copy link");
    expect(html).toContain("Not started");
  });

  test("not published: no URL, a pointer to the site editor", () => {
    const html = renderToStaticMarkup(createElement(ProofStudioHub, { statuses: allEmpty, publicUrl: null, mapState: "ok" }));
    expect(html).toContain("Not published");
    expect(html).not.toContain("/u/");
    expect(html).not.toContain("Copy link");
  });

  test("nudges to draw a career map only when none is linked", () => {
    const none = renderToStaticMarkup(createElement(ProofStudioHub, { statuses: allEmpty, publicUrl: null, mapState: "none" }));
    expect(none).toContain("Start with your career map");
    expect(none).toContain('href="/map"');
    const ok = renderToStaticMarkup(createElement(ProofStudioHub, { statuses: allEmpty, publicUrl: null, mapState: "ok" }));
    expect(ok).not.toContain("Start with your career map");
    const error = renderToStaticMarkup(createElement(ProofStudioHub, { statuses: allEmpty, publicUrl: null, mapState: "error" }));
    expect(error).not.toContain("Start with your career map");
  });

  test("describes the voice model honestly as tuned in context", () => {
    const html = renderToStaticMarkup(createElement(ProofStudioHub, { statuses: allEmpty, publicUrl: null, mapState: "ok" }));
    expect(html).toContain(VOICE_MODEL_METHOD_LABEL);
    expect(html).toContain("tuned in context");
  });

  test("the page mounts inside DashboardShell activeTab=proof with no seed marker", () => {
    const source = read("apps/web/app/dashboard/proof/page.tsx");
    expect(source).not.toContain("FOUNDATION-SEED");
    expect(source).toContain('activeTab="proof"');
    expect(source).toContain('<div className="rm" style={{ minHeight: 0, background: "transparent" }}>');
    expect(source).toContain("loadProofStatuses");
  });
});

describe("next proof step", () => {
  test("picks the first unfinished piece in build order", () => {
    expect(pickNextProofStep(allEmpty)).toMatchObject({ kind: "step", piece: { key: "site" } });
    expect(pickNextProofStep({ ...allEmpty, site: { state: "live", summary: "" } })).toMatchObject({ kind: "step", piece: { key: "model" } });
    expect(
      pickNextProofStep({ site: { state: "live", summary: "" }, model: { state: "live", summary: "" }, log: { state: "draft", summary: "" } }),
    ).toMatchObject({ kind: "step", piece: { key: "log" } });
  });

  test("skips pieces whose status is unknown instead of guessing", () => {
    expect(pickNextProofStep({ ...allEmpty, site: null })).toMatchObject({ kind: "step", piece: { key: "model" } });
    expect(pickNextProofStep({ site: null, model: { state: "live", summary: "" }, log: { state: "live", summary: "" } })).toEqual({ kind: "unknown" });
  });

  test("done when all three are live", () => {
    const live = { state: "live" as const, summary: "" };
    expect(pickNextProofStep({ site: live, model: live, log: live })).toEqual({ kind: "done" });
  });
});

describe("Your route card", () => {
  test("with a map: old title -> new title, the next step and links to map and Proof Studio", () => {
    const html = renderToStaticMarkup(createElement(YourRouteCard, { data: { map: { status: "ok", value }, statuses: { ...allEmpty, site: { state: "live", summary: "" } } } }));
    expect(html).toContain('class="rm"');
    expect(html).toContain("Senior Marketing Manager");
    expect(html).toContain("Go-to-Market Engineer");
    expect(html).toContain("rm-dot--arrived");
    expect(html).toContain("Tune your voice model on your writing");
    expect(html).toContain("Add 5 writing samples to tune it.");
    expect(html).toContain('href="/dashboard/proof/model"');
    expect(html).toContain('href="/dashboard/map"');
    expect(html).toContain('href="/dashboard/proof"');
  });

  test("without a map: a prompt to draw one at /map", () => {
    const html = renderToStaticMarkup(createElement(YourRouteCard, { data: { map: { status: "none" }, statuses: null } }));
    expect(html).toContain("Draw your career map");
    expect(html).toContain('href="/map"');
    expect(html).not.toContain("Next step");
  });

  test("unknown statuses fall back to Proof Studio; all live says so", () => {
    const unknown = renderToStaticMarkup(createElement(YourRouteCard, { data: { map: { status: "ok", value }, statuses: null } }));
    expect(unknown).toContain("Build your proof in Proof Studio");
    const live = { state: "live" as const, summary: "" };
    const done = renderToStaticMarkup(createElement(YourRouteCard, { data: { map: { status: "ok", value }, statuses: { site: live, model: live, log: live } } }));
    expect(done).toContain("All three pieces are live");
  });

  test("loader: hidden (null) when the map store fails, no status calls without a map", async () => {
    mockLatestMap.mockRejectedValue(new Error("down"));
    await expect(loadYourRouteCard({ learnerProfileId: "profile_1", published: false })).resolves.toBeNull();
    mockLatestMap.mockResolvedValue(null);
    await expect(loadYourRouteCard({ learnerProfileId: "profile_1", published: false })).resolves.toEqual({ map: { status: "none" }, statuses: null });
    expect(mockSiteStatus).not.toHaveBeenCalled();
  });

  test("loader: with a map, loads statuses failure-isolated", async () => {
    mockLatestMap.mockResolvedValue(record());
    mockSiteStatus.mockRejectedValue(new Error("down"));
    mockModelStatus.mockResolvedValue({ state: "empty", summary: "x" });
    mockLogStatus.mockResolvedValue({ state: "empty", summary: "y" });
    const data = await loadYourRouteCard({ learnerProfileId: "profile_1", published: false });
    expect(data?.statuses).toEqual({ site: null, model: { state: "empty", summary: "x" }, log: { state: "empty", summary: "y" } });
  });

  test("dashboard home mounts the card failure-isolated, only for billed learners, without touching the overlay", () => {
    const source = read("apps/web/app/dashboard/page.tsx");
    expect(source).toContain("loadYourRouteCard({ learnerProfileId: user.id, published: Boolean(user.published) }).catch(() => null)");
    expect(source).toContain("{yourRouteCard ? <YourRouteCard data={yourRouteCard} /> : null}");
    const loader = source.slice(source.indexOf("const yourRouteCard"), source.indexOf("return ("));
    expect(loader).toContain("state.billing.accessAllowed && user?.id");
    expect(source).toContain("lockOverlay={!state.billing.accessAllowed ? (");
    expect(source.indexOf("<YourRouteCard")).toBeLessThan(source.indexOf("<ReadinessScoreCard"));
  });
});

describe("seed markers", () => {
  test("no FOUNDATION-SEED marker remains in the dashboard pages this workstream owns", () => {
    for (const file of ["apps/web/app/dashboard/map/page.tsx", "apps/web/app/dashboard/proof/page.tsx"]) {
      expect(read(file)).not.toContain("FOUNDATION-SEED");
    }
  });
});
