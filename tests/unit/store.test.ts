import { describe, expect, test, beforeEach } from "vitest";
import {
  applyVerificationForSkill,
  completeArtifactGeneration,
  createDailyUpdate,
  createOnboardingSession,
  createProject,
  createSocialDrafts,
  failArtifactGeneration,
  findProjectById,
  findUserById,
  getDashboardSummary,
  publishSocialDraft,
  refreshRelevantNews,
  requestArtifactGeneration,
  resetStateForTests,
  syncProjectModuleSteps,
  updateProjectModuleStep,
} from "../../packages/shared/src/store";

const defaultUser = "user_test_0001";

describe("store workflows", () => {
  beforeEach(() => {
    resetStateForTests();
  });

  test("artifact request alone never emits a placeholder or flips built", () => {
    const project = createProject({
      userId: defaultUser,
      title: "TEST_PROJECT",
      description: "Test project for artifact generation",
    });
    expect(project).toBeTruthy();
    if (!project) return;

    const result = requestArtifactGeneration({
      userId: defaultUser,
      projectId: project.id,
      kind: "pptx",
    });

    expect(result).toBeTruthy();
    expect(result?.result.ok).toBe(true);
    // Content generation is orchestrated by the caller; the request itself
    // must not fabricate artifacts or progress.
    expect(result?.project?.artifacts.length ?? 0).toBe(0);
    expect(result?.project?.state).toBe("building");
    expect(result?.job.status).toBe("running");
  });

  test("completeArtifactGeneration records the artifact with content metadata and flips built", () => {
    const project = createProject({
      userId: defaultUser,
      title: "TEST_PROJECT_COMPLETE",
      description: "Test project for artifact completion",
    });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");

    const pending = requestArtifactGeneration({ userId: defaultUser, projectId: project.id, kind: "pptx" });
    if (!pending) throw new Error("TEST_REQUEST_FAILED");

    const completed = completeArtifactGeneration({
      jobId: pending.job.id,
      projectId: project.id,
      userId: defaultUser,
      kind: "pptx",
      url: `/generated/${project.slug}/pptx-1.pptx`,
      contentId: "content-abc",
      model: "gpt-4.1-mini",
    });

    expect(completed?.project?.state).toBe("built");
    const artifact = completed?.project?.artifacts.find((entry) => entry.kind === "pptx");
    expect(artifact?.metadata?.contentId).toBe("content-abc");
    expect(artifact?.metadata?.source).toBe("generated_artifact");
    expect(completed?.job.status).toBe("completed");

    const user = findUserById(defaultUser);
    expect(user?.skills.some((entry) => entry.status === "built" || entry.status === "verified")).toBe(true);
  });

  test("failArtifactGeneration marks the job failed with no artifact and no built flip", () => {
    const project = createProject({
      userId: defaultUser,
      title: "TEST_PROJECT_FAIL",
      description: "Test project for artifact failure",
    });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");

    const pending = requestArtifactGeneration({ userId: defaultUser, projectId: project.id, kind: "website" });
    if (!pending) throw new Error("TEST_REQUEST_FAILED");

    const failed = failArtifactGeneration({
      jobId: pending.job.id,
      projectId: project.id,
      userId: defaultUser,
      failureCode: "OPENAI_RESPONSE_FAILED:500",
    });

    expect(failed?.job.status).toBe("failed");
    expect(failed?.job.lastErrorCode).toBe("OPENAI_RESPONSE_FAILED:500");
    expect(failed?.project?.artifacts.length ?? 0).toBe(0);
    expect(failed?.project?.state).not.toBe("built");
  });

  test("completing every module step no longer auto-awards a built skill", () => {
    const project = createProject({
      userId: defaultUser,
      title: "TEST_PROJECT_STEPS",
      description: "Module step gating test",
    });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");

    syncProjectModuleSteps({
      projectId: project.id,
      userId: defaultUser,
      steps: ["Step one", "Step two"],
    });

    const synced = findProjectById(project.id);
    for (const step of synced?.moduleSteps ?? []) {
      updateProjectModuleStep({
        projectId: project.id,
        userId: defaultUser,
        stepKey: step.stepKey,
        status: "completed",
      });
    }

    const user = findUserById(defaultUser);
    const targetSkill = user?.skills.find((entry) => entry.skill === "Synthetic User Research");
    // Checklist completion may mark progress, but never fabricates "built".
    expect(targetSkill?.status ?? "in_progress").not.toBe("built");
    expect(findProjectById(project.id)?.state).not.toBe("built");
  });

  test("social publish fails in api mode without oauth connection", () => {
    const draftsResult = createSocialDrafts({ userId: defaultUser, projectId: null });
    expect(draftsResult.ok).toBe(true);
    if (!draftsResult.ok) return;

    const draft = draftsResult.drafts.find((entry) => entry.platform === "linkedin");
    expect(draft).toBeTruthy();
    if (!draft) return;

    const publishResult = publishSocialDraft({ draftId: draft.id, mode: "api" });
    expect(publishResult.ok).toBe(false);
    if (!publishResult.ok) {
      expect(publishResult.errorCode).toBe("OAUTH_NOT_CONNECTED");
    }
  });

  test("daily update requires news refresh for full payload path", () => {
    const refresh = refreshRelevantNews();
    expect(refresh.ok).toBe(true);
    if (refresh.ok) {
      expect(refresh.insights[0]?.category).toBeTruthy();
      expect(typeof refresh.insights[0]?.relevanceScore).toBe("number");
      expect(refresh.insights[0]?.recommendedAction).toBeTruthy();
    }

    const update = createDailyUpdate({ userId: defaultUser });
    expect(update.ok).toBe(true);
    if (update.ok) {
      expect(update.update.newsIds.length).toBeGreaterThan(0);
    }
  });

  test("verification upgrade path moves skill toward verified", () => {
    const user = findUserById(defaultUser);
    expect(user).toBeTruthy();
    if (!user) return;

    const updated = applyVerificationForSkill({
      userId: defaultUser,
      skill: "Prompt Engineering",
      score: 0.9,
      evidenceCountDelta: 2,
    });

    expect(updated).toBeTruthy();
    expect(updated?.status === "built" || updated?.status === "verified").toBe(true);
    expect(updated?.score).toBeGreaterThanOrEqual(0.9);
  });

  test("onboarding start creates a new user and session", () => {
    const { user, session } = createOnboardingSession({
      name: "TEST_USER_100",
      handleBase: "test-user-100",
    });

    expect(user.id).toBeTruthy();
    expect(session.userId).toBe(user.id);
    expect(session.status).toBe("started");
  });

  test("dashboard summary orders module recommendations by the learner's plan sequence", () => {
    // Default user is on product-management; catalog order starts with
    // "Synthetic User Research". A plan sequence must override it.
    const planned = getDashboardSummary(defaultUser, null, ["PRD Generation", "AI Wireframing"]);
    expect(planned?.moduleRecommendations.map((track) => track.title)).toEqual([
      "PRD Generation",
      "AI Wireframing",
      "Synthetic User Research",
      "Sentiment Analysis",
    ]);

    // No plan (old reports / no report) -> untouched catalog order.
    const unplanned = getDashboardSummary(defaultUser);
    expect(unplanned?.moduleRecommendations.map((track) => track.title)).toEqual([
      "Synthetic User Research",
      "AI Wireframing",
      "PRD Generation",
      "Sentiment Analysis",
    ]);
  });
});
