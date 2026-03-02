import { beforeEach, describe, expect, test } from "vitest";
import {
  addProjectChatMessage,
  createOnboardingSession,
  createProject,
  createSocialDrafts,
  getDashboardSummary,
  getEmployerFacets,
  listProjectEvents,
  listTalent,
  publishProfile,
  publishSocialDraft,
  requestArtifactGeneration,
  resetStateForTests,
  startAssessment,
  submitAssessment,
  updateOnboardingCareerImport,
  updateOnboardingSituation,
} from "../../packages/shared/src/store";

describe("integration flows", () => {
  beforeEach(() => {
    resetStateForTests();
  });

  test("onboarding + assessment flow", () => {
    const { user, session } = createOnboardingSession({
      name: "TEST_USER_INT_001",
      handleBase: "test-user-int-001",
      careerPathId: "software-engineering",
    });

    const situation = updateOnboardingSituation({
      sessionId: session.id,
      situation: "employed",
      goals: ["upskill_current_job"],
    });
    expect(situation?.status).toBe("collecting");

    const imported = updateOnboardingCareerImport({
      sessionId: session.id,
      careerPathId: "software-engineering",
      linkedinUrl: "https://www.linkedin.com/in/test-user-int-001",
      resumeFilename: "resume.pdf",
    });
    expect(imported?.status).toBe("assessment_pending");

    const assessment = startAssessment(user.id);
    expect(assessment).toBeTruthy();
    if (!assessment) return;

    const submitted = submitAssessment({
      assessmentId: assessment.id,
      answers: [
        { questionId: "q1", value: 4 },
        { questionId: "q2", value: 3 },
        { questionId: "q3", value: 5 },
      ],
    });

    expect(submitted?.score).toBeGreaterThan(0);
    expect(submitted?.recommendedCareerPathIds.length).toBe(3);
  });

  test("project lifecycle + events + artifact generation", () => {
    const project = createProject({
      userId: "user_test_0001",
      title: "PROJECT_INT_001",
      description: "Integration flow project",
    });
    expect(project).toBeTruthy();
    if (!project) return;

    const chat = addProjectChatMessage({
      projectId: project.id,
      userId: "user_test_0001",
      message: "Help me define acceptance criteria",
    });
    expect(chat?.result.ok).toBe(true);

    const artifact = requestArtifactGeneration({
      projectId: project.id,
      userId: "user_test_0001",
      kind: "pdf",
    });
    expect(artifact?.result.ok).toBe(true);

    const events = listProjectEvents(project.id);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((entry) => entry.type.startsWith("job."))).toBe(true);
  });

  test("social draft modes + dashboard + employer facets", () => {
    const drafts = createSocialDrafts({ userId: "user_test_0001", projectId: null });
    expect(drafts.ok).toBe(true);
    if (!drafts.ok) return;

    const draft = drafts.drafts[0];

    const apiPublish = publishSocialDraft({ draftId: draft.id, mode: "api" });
    expect(apiPublish.ok).toBe(false);

    const composerPublish = publishSocialDraft({ draftId: draft.id, mode: "composer" });
    expect(composerPublish.ok).toBe(true);

    const profile = publishProfile("user_test_0001");
    expect(profile?.published).toBe(true);

    const summary = getDashboardSummary("user_test_0001");
    expect(summary).toBeTruthy();
    expect(summary?.projects.length).toBeGreaterThan(0);

    const facets = getEmployerFacets();
    expect(facets.roles.length).toBeGreaterThan(0);

    const verifiedCandidates = listTalent({ status: "verified" });
    expect(verifiedCandidates.length).toBeGreaterThan(0);
  });
});
