import { beforeEach, describe, expect, test } from "vitest";
import {
  buildDashboardGamification,
  createProject,
  recordProjectArtifact,
  resetStateForTests,
  upsertUserProfile,
  type Project,
  type ProjectArtifact,
  type UserProfile,
} from "@aitutor/shared";
import {
  assemblePublicProfileProof,
  collectPublicArtifacts,
  derivePublicReadiness,
  gatePublicSkills,
  getPublicProfileProof,
} from "@/lib/public-profile-proof";
import type { AssessmentReport } from "@/lib/assessment-report";
import {
  appendAssessmentReport,
  resetAnonymousAssessmentStateForTests,
} from "@/lib/anonymous-assessment";
import { resetTutorSessionStateForTests } from "@/lib/tutor-session";
import { resetDailyActionStateForTests } from "@/lib/daily-action";
import { exampleProfileProof } from "@/app/u/public-profile-utils";

const NOW = new Date("2026-07-08T12:00:00.000Z");

function makeReport(score: number, plan?: AssessmentReport["thirtyDayPlan"]): AssessmentReport {
  return {
    readinessScore: score,
    headline: `Headline at ${score}`,
    summary: "Summary text.",
    strengths: [{ title: "Prompt fluency", detail: "Usable output fast." }],
    gaps: [{ title: "No automation", whyItMatters: "Time lost.", marketImpact: "high" }],
    recommendedPath: { careerPathId: "product-management", reason: "Direct fit." },
    thirtyDayPlan: plan ?? [
      { week: 1, focus: "Interview synthesis", actions: ["Run it"], moduleTitle: "Synthetic User Research" },
      { week: 2, focus: "Wireframe sprint", actions: ["Run it"], moduleTitle: "AI Wireframing" },
      { week: 3, focus: "PRD from evidence", actions: ["Run it"], moduleTitle: "PRD Generation" },
      { week: 4, focus: "Signal review", actions: ["Run it"], moduleTitle: "Sentiment Analysis" },
    ],
  };
}

function historyEntry(input: { score: number; createdAt: string; assessmentId?: string }) {
  return {
    anonymousAssessmentId: input.assessmentId ?? "assessment-1",
    createdAt: input.createdAt,
    readinessScore: input.score,
    report: makeReport(input.score),
  };
}

function makeProfile(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "user-1",
    handle: "test-builder",
    name: "Test Builder",
    headline: "Product Manager",
    bio: "Bio",
    careerPathId: "product-management",
    skills: [],
    tools: ["Cursor"],
    socialLinks: {},
    published: true,
    tokensUsed: 0,
    goals: [],
    acquisition: {},
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...over,
  };
}

const generatedArtifact: ProjectArtifact = {
  kind: "pdf",
  url: "/generated/test-project/pdf-100.pdf",
  createdAt: "2026-07-01T00:00:00.000Z",
  metadata: { source: "generated_artifact", contentId: "content-1" },
};

const placeholderArtifact: ProjectArtifact = {
  kind: "website",
  url: "/generated/test-project/website-legacy.html",
  createdAt: "2026-07-02T00:00:00.000Z",
  metadata: {},
};

const proofLinkArtifact: ProjectArtifact = {
  kind: "proof_link",
  url: "https://example.com/case-study",
  createdAt: "2026-07-03T00:00:00.000Z",
  metadata: { source: "proof_link", label: "Case study" },
};

function makeProject(artifacts: ProjectArtifact[], over: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    userId: "user-1",
    slug: "test-project",
    title: "Test Project",
    description: "A test project.",
    state: "built",
    artifacts,
    moduleSteps: [],
    buildLog: [],
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

const noMilestones = { started: 0, completed: 0, firstCompletedAt: null };

const emptyAssembly = {
  profile: makeProfile(),
  projects: [] as Project[],
  history: [] as ReturnType<typeof historyEntry>[],
  completedModuleTitles: [] as string[],
  milestones: noMilestones,
  streak: null,
  gamification: null,
  now: NOW,
};

describe("derivePublicReadiness", () => {
  test("no history means no readiness section (never fabricated)", () => {
    expect(derivePublicReadiness([])).toBeNull();
  });

  test("single entry is a baseline: score without a delta", () => {
    const readiness = derivePublicReadiness([historyEntry({ score: 52, createdAt: "2026-07-01T00:00:00.000Z" })]);
    expect(readiness).toEqual({
      score: 52,
      firstScore: 52,
      delta: null,
      headline: "Headline at 52",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
  });

  test("delta is measured against the FIRST history entry (append-only spine)", () => {
    const readiness = derivePublicReadiness([
      historyEntry({ score: 52, createdAt: "2026-06-01T00:00:00.000Z" }),
      historyEntry({ score: 60, createdAt: "2026-06-15T00:00:00.000Z" }),
      historyEntry({ score: 78, createdAt: "2026-07-01T00:00:00.000Z" }),
    ]);
    expect(readiness?.score).toBe(78);
    expect(readiness?.firstScore).toBe(52);
    expect(readiness?.delta).toBe(26);
    expect(readiness?.headline).toBe("Headline at 78");
  });
});

describe("gatePublicSkills", () => {
  const skills: UserProfile["skills"] = [
    { skill: "PRD Generation", status: "verified", score: 0.8, evidenceCount: 3 },
    { skill: "AI Wireframing", status: "built", score: 0.7, evidenceCount: 2 },
    { skill: "Sentiment Analysis", status: "in_progress", score: 0.4, evidenceCount: 1 },
  ];

  test("verified stays verified only with a completed tutor-session checklist AND real built evidence", () => {
    const gated = gatePublicSkills(skills, { artifacts: [generatedArtifact], checklistComplete: true });
    expect(gated).toEqual([
      { skill: "PRD Generation", status: "verified", evidenceCount: 3 },
      { skill: "AI Wireframing", status: "built", evidenceCount: 2 },
    ]);
  });

  test("verified without a completed checklist downgrades to built (no inflation)", () => {
    const gated = gatePublicSkills(skills, { artifacts: [generatedArtifact], checklistComplete: false });
    expect(gated.map((entry) => entry.status)).toEqual(["built", "built"]);
  });

  test("legacy placeholder artifacts never satisfy the gate: skills hidden entirely", () => {
    const gated = gatePublicSkills(skills, { artifacts: [placeholderArtifact], checklistComplete: true });
    expect(gated).toEqual([]);
  });

  test("user-submitted proof counts as built evidence", () => {
    const gated = gatePublicSkills(skills, { artifacts: [proofLinkArtifact], checklistComplete: false });
    expect(gated.map((entry) => entry.status)).toEqual(["built", "built"]);
  });

  test("in_progress skills never appear on the public trust surface", () => {
    const gated = gatePublicSkills(skills, { artifacts: [generatedArtifact], checklistComplete: true });
    expect(gated.find((entry) => entry.skill === "Sentiment Analysis")).toBeUndefined();
  });
});

describe("collectPublicArtifacts", () => {
  test("only artifacts with persisted content or submitted proof render; placeholder-era never does", () => {
    const project = makeProject([generatedArtifact, placeholderArtifact, proofLinkArtifact]);
    const artifacts = collectPublicArtifacts([project]);
    expect(artifacts.map((entry) => entry.url)).toEqual([
      "https://example.com/case-study",
      "/generated/test-project/pdf-100.pdf",
    ]);
    expect(artifacts[0]).toMatchObject({
      source: "proof",
      label: "Case study",
      projectTitle: "Test Project",
      projectSlug: "test-project",
    });
    expect(artifacts[1]).toMatchObject({ source: "generated", label: "Project Brief" });
  });

  test("no qualifying artifacts means an empty list, not placeholders", () => {
    expect(collectPublicArtifacts([makeProject([placeholderArtifact])])).toEqual([]);
  });
});

describe("assemblePublicProfileProof", () => {
  test("a profile with no report, plan, sessions, streak, or artifacts hides every proof section", () => {
    const proof = assemblePublicProfileProof(emptyAssembly);
    expect(proof).toEqual({
      readiness: null,
      plan: null,
      skills: [],
      artifacts: [],
      activity: null,
      streak: null,
      level: null,
    });
  });

  test("plan progress reports Week N of M with the week's focus and module", () => {
    const proof = assemblePublicProfileProof({
      ...emptyAssembly,
      history: [
        historyEntry({ score: 52, createdAt: "2026-06-30T00:00:00.000Z" }),
      ],
      completedModuleTitles: ["Synthetic User Research"],
      now: NOW, // 8 days after anchor => age week 2
    });
    expect(proof.plan).toMatchObject({
      currentWeek: 2,
      totalWeeks: 4,
      focus: "Wireframe sprint",
      moduleTitle: "AI Wireframing",
    });
    expect(proof.plan?.weeks).toHaveLength(4);
    expect(proof.plan?.weeks[0]).toEqual({ week: 1, completed: true, isCurrent: false });
    expect(proof.plan?.weeks[1]).toEqual({ week: 2, completed: false, isCurrent: true });
  });

  test("streak shows the effective current streak and all-time longest", () => {
    const proof = assemblePublicProfileProof({
      ...emptyAssembly,
      streak: { currentStreak: 6, longestStreak: 9, lastActionDate: "2026-07-08" },
      now: NOW,
    });
    expect(proof.streak).toEqual({ current: 6, longest: 9 });
  });

  test("a lapsed streak collapses current to 0 but keeps the longest record", () => {
    const proof = assemblePublicProfileProof({
      ...emptyAssembly,
      streak: { currentStreak: 6, longestStreak: 9, lastActionDate: "2026-07-01" },
      now: NOW,
    });
    expect(proof.streak).toEqual({ current: 0, longest: 9 });
  });

  test("an empty streak record hides the streak section", () => {
    const proof = assemblePublicProfileProof({
      ...emptyAssembly,
      streak: { currentStreak: 0, longestStreak: 0, lastActionDate: null },
      now: NOW,
    });
    expect(proof.streak).toBeNull();
  });

  test("build activity requires at least one COMPLETED tutor session", () => {
    const started = assemblePublicProfileProof({
      ...emptyAssembly,
      milestones: { started: 2, completed: 0, firstCompletedAt: null },
    });
    expect(started.activity).toBeNull();

    const completed = assemblePublicProfileProof({
      ...emptyAssembly,
      milestones: { started: 3, completed: 2, firstCompletedAt: "2026-06-25T00:00:00.000Z" },
      completedModuleTitles: ["Synthetic User Research", "AI Wireframing"],
    });
    expect(completed.activity).toEqual({
      sessionsStarted: 3,
      sessionsCompleted: 2,
      completedModules: ["Synthetic User Research", "AI Wireframing"],
    });
  });

  test("XP level passes through from the real gamification model", () => {
    const profile = makeProfile({ name: "Named", headline: "PM", bio: "Bio" });
    const gamification = buildDashboardGamification({
      user: profile,
      projects: [makeProject([generatedArtifact])],
      latestEvents: [],
      hasOnboardingSession: true,
      hasCompletedAssessment: true,
      hasSocialDraft: false,
      hasPublishedSocialDraft: false,
      activity: { dailyActionsCompleted: 5, tutorSessionsCompleted: 1, tutorSessionsStarted: 1 },
    });
    const proof = assemblePublicProfileProof({ ...emptyAssembly, gamification });
    expect(proof.level).toEqual({
      level: gamification.level,
      label: gamification.levelLabel,
      subtitle: gamification.levelSubtitle,
      xpTotal: gamification.xpTotal,
    });
    expect(proof.level && proof.level.level).toBeGreaterThanOrEqual(2);
  });
});

describe("getPublicProfileProof (memory mode, real stores)", () => {
  beforeEach(() => {
    resetStateForTests();
    resetAnonymousAssessmentStateForTests();
    resetTutorSessionStateForTests();
    resetDailyActionStateForTests();
  });

  test("a published user with linked reports and a real generated artifact gets an honest proof block", async () => {
    const profile = upsertUserProfile({
      id: "user-proof-1",
      handle: "proof-builder",
      name: "Proof Builder",
      headline: "Product Manager",
      bio: "Builds in public.",
      careerPathId: "product-management",
      published: true,
      skills: [{ skill: "PRD Generation", status: "verified", score: 0.8, evidenceCount: 3 }],
    });
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
      metadata: { source: "generated_artifact", contentId: "content-live-1" },
    });

    await appendAssessmentReport({
      anonymousAssessmentId: "assessment-live-1",
      learnerProfileId: profile.id,
      readinessScore: 55,
      report: makeReport(55),
    });
    await appendAssessmentReport({
      anonymousAssessmentId: "assessment-live-1",
      learnerProfileId: profile.id,
      readinessScore: 63,
      report: makeReport(63),
    });

    const projects = [project];
    const proof = await getPublicProfileProof(profile, projects);

    expect(proof.readiness?.score).toBe(63);
    expect(proof.readiness?.delta).toBe(8);
    expect(proof.plan?.totalWeeks).toBe(4);
    expect(proof.plan?.currentWeek).toBeGreaterThanOrEqual(1);
    // Verified downgrades to built: no completed tutor session yet.
    expect(proof.skills.map((entry) => entry.status)).toContain("built");
    expect(proof.skills.find((entry) => entry.status === "verified")).toBeUndefined();
    expect(proof.artifacts).toHaveLength(1);
    expect(proof.artifacts[0]?.url).toBe(`/generated/${project.slug}/pdf-1.pdf`);
    expect(proof.activity).toBeNull();
    expect(proof.streak).toBeNull();
    expect(proof.level?.level).toBeGreaterThanOrEqual(1);
    expect(proof.level?.xpTotal).toBeGreaterThan(0);
  });

  test("a user with no data renders gracefully: everything hidden, nothing fabricated, no throw", async () => {
    const profile = upsertUserProfile({
      id: "user-bare-1",
      handle: "bare-user",
      name: "Bare User",
      published: true,
    });
    const proof = await getPublicProfileProof(profile, []);
    expect(proof.readiness).toBeNull();
    expect(proof.plan).toBeNull();
    expect(proof.skills).toEqual([]);
    expect(proof.artifacts).toEqual([]);
    expect(proof.activity).toBeNull();
    expect(proof.streak).toBeNull();
    // Level may exist (a real Level 1) but must never be fabricated above reality.
    if (proof.level) {
      expect(proof.level.level).toBe(1);
    }
  });
});

describe("exampleProfileProof (the alex-chen-ai demo)", () => {
  test("demonstrates every rebuilt section with internally consistent data", () => {
    const proof = exampleProfileProof();

    // Readiness score with growth since the first assessment.
    expect(proof.readiness).not.toBeNull();
    expect(proof.readiness?.delta).toBeGreaterThan(0);
    expect(proof.readiness?.score).toBeGreaterThan(proof.readiness?.firstScore ?? 0);

    // 30-day plan mid-flight with real catalog modules.
    expect(proof.plan?.totalWeeks).toBe(4);
    expect(proof.plan?.currentWeek).toBe(3);
    expect(proof.plan?.moduleTitle).toBe("PRD Generation");

    // Gated skills only; the in-progress skill never leaks.
    expect(proof.skills.length).toBeGreaterThanOrEqual(2);
    expect(proof.skills.some((entry) => entry.status === "verified")).toBe(true);
    expect(proof.skills.find((entry) => entry.skill === "Sentiment Analysis")).toBeUndefined();

    // Real artifact links through the demo-rendering generated route.
    expect(proof.artifacts.length).toBeGreaterThanOrEqual(2);
    for (const artifact of proof.artifacts) {
      if (artifact.source === "generated") {
        expect(artifact.url.startsWith("/generated/demo/")).toBe(true);
      }
    }

    // Tutor-session-backed activity, streak, and XP level.
    expect(proof.activity?.sessionsCompleted).toBeGreaterThanOrEqual(2);
    expect(proof.streak).toEqual({ current: 5, longest: 6 });
    expect(proof.level?.level).toBeGreaterThanOrEqual(3);
  });
});
