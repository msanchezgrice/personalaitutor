import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createProject,
  findProjectById,
  findUserById,
  resetStateForTests,
  upsertBillingSubscription,
} from "@aitutor/shared";
import { runtimeRequestArtifactGeneration } from "@/lib/artifact-generation";
import {
  getArtifactContentByUrl,
  resetArtifactContentStateForTests,
} from "@/lib/artifact-content-store";

const userId = "user_test_0001";

const validWebsiteContent = {
  title: "Test User — AI Workflow Proof",
  tagline: "A real generated site.",
  heroCta: "See the work",
  sections: [
    { heading: "The workflow", body: "What was automated." },
    { heading: "How", body: "Prompt pack plus review loop." },
    { heading: "Results", body: "Faster output with checks." },
  ],
  footerNote: "Generated proof-of-work.",
};

const validDeckContent = {
  title: "AI Workflow Deck",
  subtitle: "Proof in four slides",
  slides: [
    { title: "Problem", bullets: ["Slow", "Manual"], speakerNotes: "Open strong." },
    { title: "Approach", bullets: ["Prompt pack", "Review"], speakerNotes: "Explain." },
    { title: "Result", bullets: ["Faster", "Verified"], speakerNotes: "Show." },
    { title: "Next", bullets: ["Scale", "Teach"], speakerNotes: "Close." },
  ],
};

function okOpenAiResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: JSON.stringify(payload) }),
    text: async () => "",
  };
}

function enableBilling() {
  upsertBillingSubscription({
    userId,
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    stripePriceId: "price_test",
    status: "active",
    trialEndsAt: null,
    currentPeriodEndsAt: null,
    cancelAtPeriodEnd: false,
  });
}

function makeProject() {
  const project = createProject({
    userId,
    title: "ARTIFACT_GEN_TEST",
    description: "Artifact generation pipeline test project",
  });
  if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");
  return project;
}

describe("runtimeRequestArtifactGeneration (memory mode)", () => {
  beforeEach(() => {
    resetStateForTests();
    resetArtifactContentStateForTests();
    enableBilling();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("success: generates real content, persists it, flips built, awards skill", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okOpenAiResponse(validWebsiteContent)));
    const project = makeProject();

    const result = await runtimeRequestArtifactGeneration({
      projectId: project.id,
      userId,
      kind: "website",
    });

    expect(result?.result.ok).toBe(true);
    expect(result?.job.status).toBe("completed");

    const updated = findProjectById(project.id);
    expect(updated?.state).toBe("built");

    const artifact = updated?.artifacts.find((entry) => entry.kind === "website");
    expect(artifact).toBeTruthy();
    expect(artifact?.metadata?.source).toBe("generated_artifact");
    expect(artifact?.metadata?.contentId).toBeTruthy();

    // The structured content is persisted and retrievable by artifact URL.
    const stored = await getArtifactContentByUrl(artifact!.url);
    expect(stored).toBeTruthy();
    expect(stored?.contentKind).toBe("website");
    expect((stored?.content as { title: string }).title).toContain("AI Workflow Proof");

    // Skill awarded only after real content exists.
    const user = findUserById(userId);
    const skill = user?.skills.find((entry) => entry.status === "built" || entry.status === "verified");
    expect(skill).toBeTruthy();
  });

  test("deck generation persists deck content for pptx artifacts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okOpenAiResponse(validDeckContent)));
    const project = makeProject();

    const result = await runtimeRequestArtifactGeneration({ projectId: project.id, userId, kind: "pptx" });
    expect(result?.result.ok).toBe(true);

    const artifact = findProjectById(project.id)?.artifacts.find((entry) => entry.kind === "pptx");
    const stored = await getArtifactContentByUrl(artifact!.url);
    expect(stored?.contentKind).toBe("deck");
    expect((stored?.content as { slides: unknown[] }).slides).toHaveLength(4);
  });

  test("LLM failure: job fails, NO artifact, NO built flip, NO skill award, NO stored content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom", json: async () => ({}) }),
    );
    const project = makeProject();
    const skillCountBefore = findUserById(userId)?.skills.length ?? 0;

    const result = await runtimeRequestArtifactGeneration({ projectId: project.id, userId, kind: "website" });

    expect(result?.result.ok).toBe(false);
    expect(result?.job.status).toBe("failed");
    expect(result?.job.lastErrorCode).toContain("OPENAI_RESPONSE_FAILED");

    const updated = findProjectById(project.id);
    expect(updated?.state).not.toBe("built");
    expect(updated?.artifacts.some((entry) => entry.kind === "website")).toBe(false);
    expect(findUserById(userId)?.skills.length).toBe(skillCountBefore);
  });

  test("invalid model output: hard failure with no placeholder emission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okOpenAiResponse({ garbage: true })));
    const project = makeProject();

    const result = await runtimeRequestArtifactGeneration({ projectId: project.id, userId, kind: "pdf" });

    expect(result?.result.ok).toBe(false);
    expect(result?.job.lastErrorCode).toContain("ARTIFACT_CONTENT_INVALID_OUTPUT");
    expect(findProjectById(project.id)?.artifacts.length ?? 0).toBe(0);
  });

  test("missing OpenAI key: fails with OPENAI_CONFIG_MISSING and no state flip", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const project = makeProject();

    const result = await runtimeRequestArtifactGeneration({ projectId: project.id, userId, kind: "website" });

    expect(result?.result.ok).toBe(false);
    expect(result?.job.lastErrorCode).toBe("OPENAI_CONFIG_MISSING");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(findProjectById(project.id)?.state).not.toBe("built");
  });

  test("forceFailCode preserves the deterministic failure path", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const project = makeProject();

    const result = await runtimeRequestArtifactGeneration({
      projectId: project.id,
      userId,
      kind: "website",
      forceFailCode: "GEN_TIMEOUT",
    });

    expect(result?.result.ok).toBe(false);
    expect(result?.job.lastErrorCode).toBe("GEN_TIMEOUT");
    expect(findProjectById(project.id)?.artifacts.length ?? 0).toBe(0);
  });

  test("billing gate still blocks non-subscribed users", async () => {
    resetStateForTests();
    resetArtifactContentStateForTests();
    const project = makeProject();
    const result = await runtimeRequestArtifactGeneration({ projectId: project.id, userId, kind: "website" });
    expect(result).toBeNull();
  });
});
