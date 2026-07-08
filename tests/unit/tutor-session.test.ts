import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildRecommendedModuleGuide } from "@aitutor/shared";
import {
  buildTutorSessionPrompt,
  completeTutorSession,
  completeTutorSessionStep,
  generateTutorSessionReply,
  getTutorSessionForProject,
  resetTutorSessionStateForTests,
  setTutorChecklistItem,
  startTutorSession,
} from "@/lib/tutor-session";

const guide = buildRecommendedModuleGuide({
  careerPathId: "marketing-seo",
  moduleTitle: "Content Systems",
  jobTitle: "Growth Marketing Manager",
  primaryGoal: "upskill_current_job",
});

const learnerProfileId = "user_test_0001";
const projectId = "project_alpha_001";

async function startSession() {
  return startTutorSession({ projectId, learnerProfileId, guide });
}

describe("tutor session lifecycle", () => {
  beforeEach(() => {
    resetTutorSessionStateForTests();
  });

  test("start creates a session from the playbook with steps and checklist", async () => {
    const session = await startSession();
    expect(session.status).toBe("active");
    expect(session.projectId).toBe(projectId);
    expect(session.moduleTitle).toBe("Content Systems");
    expect(session.steps).toHaveLength(guide.steps.length);
    expect(session.steps[0].title).toBe(guide.steps[0]);
    expect(session.steps.every((step) => step.status === "pending")).toBe(true);
    expect(session.checklist).toHaveLength(guide.proofChecklist.length);
    expect(session.checklist.every((item) => !item.done)).toBe(true);
    expect(session.currentStepIndex).toBe(0);
  });

  test("start is resumable: a second start returns the same active session", async () => {
    const first = await startSession();
    await completeTutorSessionStep({ sessionId: first.id, learnerProfileId, stepIndex: 0, evidenceNote: "picked campaign" });

    const resumed = await startSession();
    expect(resumed.id).toBe(first.id);
    expect(resumed.steps[0].status).toBe("completed");
    expect(resumed.currentStepIndex).toBe(1);
  });

  test("getTutorSessionForProject returns null when no session exists", async () => {
    expect(await getTutorSessionForProject({ projectId: "unknown", learnerProfileId })).toBeNull();
  });

  test("completing steps advances the current step and stores evidence notes", async () => {
    const session = await startSession();

    const afterFirst = await completeTutorSessionStep({
      sessionId: session.id,
      learnerProfileId,
      stepIndex: 0,
      evidenceNote: "Chose the Q3 campaign",
    });
    expect(afterFirst?.steps[0].status).toBe("completed");
    expect(afterFirst?.steps[0].evidenceNote).toBe("Chose the Q3 campaign");
    expect(afterFirst?.steps[0].completedAt).toBeTruthy();
    expect(afterFirst?.currentStepIndex).toBe(1);

    const afterSecond = await completeTutorSessionStep({ sessionId: session.id, learnerProfileId, stepIndex: 1 });
    expect(afterSecond?.currentStepIndex).toBe(2);
  });

  test("completing an unknown step fails without mutating the session", async () => {
    const session = await startSession();
    await expect(
      completeTutorSessionStep({ sessionId: session.id, learnerProfileId, stepIndex: 99 }),
    ).rejects.toThrow("TUTOR_SESSION_STEP_NOT_FOUND");
    const unchanged = await getTutorSessionForProject({ projectId, learnerProfileId });
    expect(unchanged?.steps.every((step) => step.status === "pending")).toBe(true);
  });

  test("checklist items toggle with evidence", async () => {
    const session = await startSession();
    const updated = await setTutorChecklistItem({
      sessionId: session.id,
      learnerProfileId,
      itemIndex: 0,
      done: true,
      evidence: "Screenshot of audience list",
    });
    expect(updated?.checklist[0].done).toBe(true);
    expect(updated?.checklist[0].evidence).toBe("Screenshot of audience list");
    expect(updated?.checklist[0].completedAt).toBeTruthy();

    const reverted = await setTutorChecklistItem({ sessionId: session.id, learnerProfileId, itemIndex: 0, done: false });
    expect(reverted?.checklist[0].done).toBe(false);
  });

  test("complete is blocked until all steps and checklist items are done", async () => {
    const session = await startSession();
    const blocked = await completeTutorSession({ sessionId: session.id, learnerProfileId });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.errorCode).toBe("TUTOR_SESSION_INCOMPLETE");
      expect(blocked.pendingSteps).toBe(guide.steps.length);
      expect(blocked.pendingChecklist).toBe(guide.proofChecklist.length);
    }

    for (let index = 0; index < guide.steps.length; index += 1) {
      await completeTutorSessionStep({ sessionId: session.id, learnerProfileId, stepIndex: index });
    }
    for (let index = 0; index < guide.proofChecklist.length; index += 1) {
      await setTutorChecklistItem({ sessionId: session.id, learnerProfileId, itemIndex: index, done: true });
    }

    const completed = await completeTutorSession({ sessionId: session.id, learnerProfileId });
    expect(completed.ok).toBe(true);
    if (completed.ok) {
      expect(completed.session.status).toBe("completed");
      expect(completed.session.completedAt).toBeTruthy();
    }
  });

  test("a completed session is not resumed; a new start creates a fresh session", async () => {
    const session = await startSession();
    for (let index = 0; index < guide.steps.length; index += 1) {
      await completeTutorSessionStep({ sessionId: session.id, learnerProfileId, stepIndex: index });
    }
    for (let index = 0; index < guide.proofChecklist.length; index += 1) {
      await setTutorChecklistItem({ sessionId: session.id, learnerProfileId, itemIndex: index, done: true });
    }
    await completeTutorSession({ sessionId: session.id, learnerProfileId });

    const next = await startSession();
    expect(next.id).not.toBe(session.id);
    expect(next.status).toBe("active");
  });
});

describe("tutor session prompt", () => {
  beforeEach(() => {
    resetTutorSessionStateForTests();
  });

  test("prompt includes playbook, profile, assessment context, and session state", async () => {
    const session = await startSession();
    const prompt = buildTutorSessionPrompt({
      session,
      guide,
      learner: { name: "Maya Chen", headline: "Growth Marketing Manager", goals: ["upskill_current_job"] },
      assessment: { readinessScore: 54, headline: "Solid instincts, manual toolkit.", topGaps: ["No automated workflow"] },
      message: "Where do I start?",
    });

    expect(prompt).toContain("Content Systems");
    expect(prompt).toContain(guide.whyThisModule);
    expect(prompt).toContain(guide.proofChecklist[0]);
    expect(prompt).toContain("Maya Chen");
    expect(prompt).toContain("54");
    expect(prompt).toContain("No automated workflow");
    expect(prompt).toContain(`Current step: 1 of ${guide.steps.length}`);
    expect(prompt).toContain("Where do I start?");
  });
});

describe("tutor session reply", () => {
  beforeEach(() => {
    resetTutorSessionStateForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("fails loudly with OPENAI_CONFIG_MISSING when no key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const session = await startSession();
    await expect(
      generateTutorSessionReply({
        session,
        guide,
        learner: { name: "Maya", headline: null, goals: [] },
        assessment: null,
        message: "help",
      }),
    ).rejects.toThrow("OPENAI_CONFIG_MISSING");
  });

  test("returns the model reply on success", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ output_text: "Start by picking the Q3 campaign brief." }),
        text: async () => "",
      }),
    );
    const session = await startSession();
    const reply = await generateTutorSessionReply({
      session,
      guide,
      learner: { name: "Maya", headline: null, goals: [] },
      assessment: null,
      message: "help",
    });
    expect(reply).toContain("Q3 campaign");
  });
});

describe("playbook drift + restart (F5)", () => {
  beforeEach(() => {
    resetTutorSessionStateForTests();
  });

  test("a fresh session is not drifted against its own guide", async () => {
    const { tutorSessionPlaybookDrifted } = await import("@/lib/tutor-session");
    const session = await startSession();
    expect(tutorSessionPlaybookDrifted(session, guide)).toBe(false);
  });

  test("drift is detected when the playbook steps or checklist change", async () => {
    const { tutorSessionPlaybookDrifted } = await import("@/lib/tutor-session");
    const session = await startSession();

    const changedSteps = {
      ...guide,
      steps: [...guide.steps.slice(0, -1), "A brand new final step (10 min)."],
    };
    expect(tutorSessionPlaybookDrifted(session, changedSteps)).toBe(true);

    const changedChecklist = {
      ...guide,
      proofChecklist: [...guide.proofChecklist, "Paste one more thing."],
    };
    expect(tutorSessionPlaybookDrifted(session, changedChecklist)).toBe(true);

    const changedCount = { ...guide, steps: guide.steps.slice(0, 2) };
    expect(tutorSessionPlaybookDrifted(session, changedCount)).toBe(true);
  });

  test("restart archives the old session and creates a fresh one from the new playbook", async () => {
    const { restartTutorSession, isTutorSessionArchived } = await import("@/lib/tutor-session");
    const first = await startSession();
    await completeTutorSessionStep({ sessionId: first.id, learnerProfileId, stepIndex: 0, evidenceNote: "old work" });

    const fresh = await restartTutorSession({ projectId, learnerProfileId, guide });
    expect(fresh.id).not.toBe(first.id);
    expect(fresh.status).toBe("active");
    expect(fresh.steps.every((step) => step.status === "pending")).toBe(true);

    // The active session for the project is now the fresh one.
    const active = await getTutorSessionForProject({ projectId, learnerProfileId });
    expect(active?.id).toBe(fresh.id);

    // Restart with no prior active session simply starts one.
    resetTutorSessionStateForTests();
    const started = await restartTutorSession({ projectId, learnerProfileId, guide });
    expect(started.status).toBe("active");
    expect(isTutorSessionArchived(started)).toBe(false);
  });

  test("archived sessions never count as completed milestones (no false XP)", async () => {
    const { restartTutorSession, countTutorSessionMilestones } = await import("@/lib/tutor-session");
    const first = await startSession();
    await completeTutorSessionStep({ sessionId: first.id, learnerProfileId, stepIndex: 0 });
    await restartTutorSession({ projectId, learnerProfileId, guide });

    const milestones = await countTutorSessionMilestones(learnerProfileId);
    expect(milestones.completed).toBe(0);
    expect(milestones.firstCompletedAt).toBeNull();
    expect(milestones.started).toBe(2);
  });
});
