import { beforeEach, describe, expect, test, vi } from "vitest";
// eslint-disable-next-line import/no-relative-packages -- matches existing test convention
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import {
  createProject,
  recordProjectArtifact,
  resetStateForTests,
  upsertBillingSubscription,
  upsertUserProfile,
} from "@aitutor/shared";
import {
  appendAssessmentReport,
  resetAnonymousAssessmentStateForTests,
} from "@/lib/anonymous-assessment";
import { resetTutorSessionStateForTests } from "@/lib/tutor-session";
import { resetDailyActionStateForTests } from "@/lib/daily-action";
import type { AssessmentReport } from "@/lib/assessment-report";
import { runtimePublishProfile } from "@/lib/runtime";

/**
 * End-to-end (in code) coverage for the public proof page: memory-mode real
 * stores feed the page component, so what renders here is exactly what the
 * publish flow produces — no mocked read models.
 */

const authSeedMock = vi.hoisted(() => vi.fn(async () => null as { userId: string } | null));
vi.mock("@/lib/auth", () => ({ getAuthSeed: authSeedMock }));

import PublicProfilePage from "@/app/u/[handle]/page";
import PublicProjectPage from "@/app/u/[handle]/projects/[projectSlug]/page";

function makeReport(score: number): AssessmentReport {
  return {
    readinessScore: score,
    headline: `Readiness headline ${score}`,
    summary: "Summary.",
    strengths: [{ title: "Prompting", detail: "Fast iterations." }],
    gaps: [{ title: "Automation", whyItMatters: "Time.", marketImpact: "high" }],
    recommendedPath: { careerPathId: "product-management", reason: "Fit." },
    thirtyDayPlan: [
      { week: 1, focus: "Interview synthesis", actions: ["Do it"], moduleTitle: "Synthetic User Research" },
      { week: 2, focus: "Wireframe sprint", actions: ["Do it"], moduleTitle: "AI Wireframing" },
    ],
  };
}

async function renderProfile(handle: string) {
  const element = await PublicProfilePage({ params: Promise.resolve({ handle }) });
  return renderToStaticMarkup(element);
}

async function seedPublishedUser() {
  const profile = upsertUserProfile({
    id: "user-page-1",
    handle: "page-builder",
    name: "Page Builder",
    headline: "Product Manager",
    bio: "Building AI proof in public.",
    careerPathId: "product-management",
    published: true,
    skills: [{ skill: "PRD Generation", status: "built", score: 0.73, evidenceCount: 2 }],
    tools: ["Cursor"],
    socialLinks: {},
  });
  return profile;
}

describe("public profile page (memory mode, real data assembly)", () => {
  beforeEach(() => {
    resetStateForTests();
    resetAnonymousAssessmentStateForTests();
    resetTutorSessionStateForTests();
    resetDailyActionStateForTests();
    authSeedMock.mockResolvedValue(null);
  });

  test("published profile renders score, plan, gated skills, and real artifact links from real tables", async () => {
    const profile = await seedPublishedUser();
    const project = createProject({
      userId: profile.id,
      title: "Discovery Copilot",
      description: "Interview synthesis workflow.",
    });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");
    recordProjectArtifact({
      projectId: project.id,
      userId: profile.id,
      kind: "pdf",
      url: `/generated/${project.slug}/pdf-1.pdf`,
      logMessage: "Generated brief",
      metadata: { source: "generated_artifact", contentId: "content-page-1" },
    });
    await appendAssessmentReport({
      anonymousAssessmentId: "assessment-page-1",
      learnerProfileId: profile.id,
      readinessScore: 54,
      report: makeReport(54),
    });
    await appendAssessmentReport({
      anonymousAssessmentId: "assessment-page-1",
      learnerProfileId: profile.id,
      readinessScore: 61,
      report: makeReport(61),
    });

    const html = await renderProfile(profile.handle);

    // Readiness score from assessment_report_history with delta vs first row.
    expect(html).toContain("AI-readiness score");
    expect(html).toContain(">61<");
    expect(html).toContain("+7 since first assessment");

    // 30-day plan progress (fresh report => week 1).
    expect(html).toContain("30-Day Plan");
    expect(html).toContain("Week 1");
    expect(html).toContain("Interview synthesis");
    expect(html).toContain("Synthetic User Research");

    // Gated skills: built evidence exists, no completed tutor session =>
    // "Built" chips, never "Verified", and never the old percentage bars
    // (skill score 0.73 would have rendered as "73%").
    expect(html).toContain("PRD Generation");
    expect(html).toContain(">Built<");
    expect(html).not.toContain(">Verified<");
    expect(html).not.toContain("73%");

    // Real artifact link to the /generated page.
    expect(html).toContain(`/generated/${project.slug}/pdf-1.pdf`);
    expect(html).toContain("Generated artifact");
    expect(html).toContain("Public proof profile");
  });

  test("placeholder-era artifacts never render: excluded from links, counts, and skill gating", async () => {
    const profile = await seedPublishedUser();
    const project = createProject({
      userId: profile.id,
      title: "Legacy Project",
      description: "Has only a placeholder artifact.",
    });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");
    // Simulate the legacy pipeline: artifact URL recorded with NO content id.
    recordProjectArtifact({
      projectId: project.id,
      userId: profile.id,
      kind: "website",
      url: `/generated/${project.slug}/website-1.html`,
      logMessage: "Legacy placeholder artifact",
      metadata: {},
    });

    const html = await renderProfile(profile.handle);

    expect(html).not.toContain(`/generated/${project.slug}/website-1.html`);
    expect(html).toContain("0 proof artifacts");
    expect(html).toContain("No verified skills yet");
    expect(html).not.toContain("Proof Artifacts");
  });

  test("a published user with no report, plan, streak, or sessions renders gracefully with sections hidden", async () => {
    const profile = upsertUserProfile({
      id: "user-bare-page",
      handle: "bare-page-user",
      name: "Bare Page User",
      published: true,
      skills: [],
    });

    const html = await renderProfile(profile.handle);

    expect(html).toContain("Bare Page User");
    expect(html).not.toContain("AI-readiness score");
    expect(html).not.toContain("30-Day Plan");
    // A real Level 1 may render, but streak/session activity never appear
    // without data behind them.
    expect(html).not.toContain("Current streak");
    expect(html).not.toContain("Tutor-session build activity");
    expect(html).toContain("No verified skills yet");
  });

  test("unpublished profiles 404 for anonymous visitors but render as owner preview for the owner", async () => {
    const profile = upsertUserProfile({
      id: "user-private-page",
      handle: "private-page-user",
      name: "Private Page User",
      published: false,
      skills: [],
    });

    await expect(renderProfile(profile.handle)).rejects.toThrow();

    authSeedMock.mockResolvedValue({ userId: profile.id });
    const html = await renderProfile(profile.handle);
    expect(html).toContain("Private owner preview");
    expect(html).toContain("owner preview");
  });

  test("publish flow: runtimePublishProfile flips the flag and the page serves the public label", async () => {
    const profile = upsertUserProfile({
      id: "user-publish-flow",
      handle: "publish-flow-user",
      name: "Publish Flow User",
      published: false,
      skills: [],
    });

    // Before publish: anonymous visitors get a 404.
    await expect(renderProfile(profile.handle)).rejects.toThrow();

    // Publish requires billing entitlement (same gate as /api/profile/publish).
    upsertBillingSubscription({
      userId: profile.id,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      stripePriceId: "price_test",
      status: "active",
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
    });
    const published = await runtimePublishProfile(profile.id);
    expect(published?.published).toBe(true);

    const html = await renderProfile(profile.handle);
    expect(html).toContain("Public proof profile");
  });

  test("the example profile keeps its label and demonstrates the rebuilt sections", async () => {
    const html = await renderProfile("alex-chen-ai");

    expect(html).toContain("Example profile");
    expect(html).toContain("AI-readiness score");
    expect(html).toContain(">78<");
    expect(html).toContain("+26 since first assessment");
    expect(html).toContain("30-Day Plan");
    expect(html).toContain("Week 3");
    expect(html).toContain("PRD Generation");
    expect(html).toContain(">Verified<");
    expect(html).toContain("/generated/demo/");
    expect(html).toContain("Momentum");
    expect(html).toContain("Current streak");
    // The old fabricated skill-percentage badges (86%/79%-style) are gone;
    // the example's 0.82-score skill must not render as "82%".
    expect(html).not.toContain("82%");
  });

  test("the example project page renders only content-backed outputs", async () => {
    const element = await PublicProjectPage({
      params: Promise.resolve({ handle: "alex-chen-ai", projectSlug: "customer-support-copilot" }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("/generated/demo/pdf-support-brief.pdf");
    expect(html).toContain("Project Brief");
    expect(html).toContain("Proof artifacts");
  });
});
