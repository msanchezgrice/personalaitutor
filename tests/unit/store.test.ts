import { describe, expect, test, beforeEach } from "vitest";
import {
  applyVerificationForSkill,
  createDailyUpdate,
  createOnboardingSession,
  createProject,
  createSocialDrafts,
  findUserById,
  publishSocialDraft,
  refreshRelevantNews,
  requestArtifactGeneration,
  resetStateForTests,
} from "../../packages/shared/src/store";

const defaultUser = "user_test_0001";

describe("store workflows", () => {
  beforeEach(() => {
    resetStateForTests();
  });

  test("artifact generation creates evidence and keeps deterministic state", () => {
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
    expect(result?.project?.artifacts.some((entry) => entry.kind === "pptx")).toBe(true);
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
});
