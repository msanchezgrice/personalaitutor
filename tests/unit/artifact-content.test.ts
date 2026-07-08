import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  artifactContentKindFor,
  briefContentSchema,
  buildArtifactContentPrompt,
  deckContentSchema,
  generateArtifactContent,
  parseArtifactContent,
  resumeContentSchema,
  websiteContentSchema,
  type ArtifactGenerationContext,
} from "@aitutor/shared";

const validWebsiteContent = {
  title: "Maya Chen — AI-Native Growth Marketing",
  tagline: "Campaigns that ship faster because AI does the heavy lifting.",
  heroCta: "See the proof",
  sections: [
    { heading: "What I automated", body: "Built an AI-assisted campaign brief pipeline.", bullets: ["Cut brief time 60%"] },
    { heading: "How it works", body: "Prompt packs feed a structured review flow." },
    { heading: "Results", body: "Consistent output quality with a verification checklist." },
  ],
  footerNote: "Built as proof-of-work with My AI Skill Tutor.",
};

const validResumeContent = {
  fullName: "Maya Chen",
  headline: "Growth Marketing Manager | AI-Assisted Campaign Systems",
  summary: "Growth marketer who systematized AI into campaign production.",
  experienceBullets: [
    "Automated campaign brief drafting with a reusable prompt pack, cutting turnaround 60%",
    "Built an AI-assisted keyword clustering workflow for SEO sprints",
    "Introduced an output verification checklist adopted by the marketing team",
  ],
  skills: ["Prompt engineering", "Campaign automation", "SEO clustering"],
  aiProof: ["Shipped one verified AI workflow artifact via My AI Skill Tutor"],
};

const validDeckContent = {
  title: "AI-Assisted Campaign Production",
  subtitle: "How one workflow changed our marketing throughput",
  slides: [
    { title: "The bottleneck", bullets: ["Briefs took 3 days", "Quality varied"], speakerNotes: "Open with the pain." },
    { title: "The workflow", bullets: ["Prompt pack", "Structured review"], speakerNotes: "Walk the pipeline." },
    { title: "The proof", bullets: ["60% faster", "Checklist-verified"], speakerNotes: "Show the artifact." },
    { title: "Next steps", bullets: ["Scale to email", "Train the team"], speakerNotes: "Land the ask." },
  ],
};

function baseContext(): ArtifactGenerationContext {
  return {
    learner: {
      name: "Maya Chen",
      headline: "Growth Marketing Manager",
      careerPathId: "marketing-seo",
      careerPathName: "Marketing & SEO",
      goals: ["upskill_current_job"],
    },
    assessment: {
      readinessScore: 54,
      headline: "Solid instincts, manual toolkit.",
      summary: "Uses AI ad hoc; no systematized workflow yet.",
      topGaps: [
        { title: "No automated workflow", whyItMatters: "Market expects pipelines.", marketImpact: "high" },
      ],
    },
    module: {
      moduleTitle: "Content Systems",
      whyThisModule: "Fastest route to visible growth proof.",
      expectedOutput: "A campaign brief system tied to one measurable goal.",
      proofChecklist: ["Show the target audience.", "Show the AI-assisted output.", "State the metric."],
      steps: ["Pick one campaign.", "Run the module on a real workflow.", "Package the result."],
    },
    project: {
      title: "Campaign Brief System",
      slug: "campaign-brief-system",
      description: "AI-assisted campaign brief pipeline.",
    },
    evidence: {
      completedSteps: [{ title: "Pick one campaign.", completedAt: "2026-07-01T00:00:00.000Z" }],
      proofArtifacts: [{ kind: "proof_link", url: "https://example.com/demo", note: "Live workflow demo" }],
      buildNotes: ["Ran the scoring workflow on 25 accounts."],
    },
  };
}

function okOpenAiResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: typeof payload === "string" ? payload : JSON.stringify(payload) }),
    text: async () => "",
  };
}

describe("artifact content kind mapping", () => {
  test("maps artifact kinds to content kinds", () => {
    expect(artifactContentKindFor("website")).toBe("website");
    expect(artifactContentKindFor("resume_docx")).toBe("resume");
    expect(artifactContentKindFor("resume_pdf")).toBe("resume");
    expect(artifactContentKindFor("pptx")).toBe("deck");
    expect(artifactContentKindFor("pdf")).toBe("brief");
  });

  test("rejects non-generatable kinds", () => {
    expect(() => artifactContentKindFor("proof_link")).toThrow("ARTIFACT_KIND_NOT_GENERATABLE");
    expect(() => artifactContentKindFor("proof_upload")).toThrow("ARTIFACT_KIND_NOT_GENERATABLE");
  });
});

describe("artifact content schemas", () => {
  test("accepts valid website content", () => {
    const parsed = websiteContentSchema.parse(validWebsiteContent);
    expect(parsed.sections).toHaveLength(3);
  });

  test("rejects website content with too few sections", () => {
    expect(websiteContentSchema.safeParse({ ...validWebsiteContent, sections: [validWebsiteContent.sections[0]] }).success).toBe(false);
  });

  test("accepts valid resume content and rejects thin bullets", () => {
    expect(resumeContentSchema.parse(validResumeContent).experienceBullets.length).toBeGreaterThanOrEqual(3);
    expect(resumeContentSchema.safeParse({ ...validResumeContent, experienceBullets: ["one"] }).success).toBe(false);
  });

  test("deck content requires slides with speaker notes", () => {
    expect(deckContentSchema.parse(validDeckContent).slides).toHaveLength(4);
    const withoutNotes = {
      ...validDeckContent,
      slides: validDeckContent.slides.map(({ title, bullets }) => ({ title, bullets })),
    };
    expect(deckContentSchema.safeParse(withoutNotes).success).toBe(false);
  });

  test("brief content requires sections and next steps", () => {
    const valid = {
      title: "Project Brief",
      summary: "A short synthesis.",
      sections: [
        { heading: "Context", body: "Why this exists." },
        { heading: "Outcome", body: "What changed." },
      ],
      nextSteps: ["Ship it", "Show it"],
    };
    expect(briefContentSchema.parse(valid).nextSteps).toHaveLength(2);
    expect(briefContentSchema.safeParse({ ...valid, sections: [] }).success).toBe(false);
  });
});

describe("parseArtifactContent", () => {
  test("parses code-fenced JSON", () => {
    const raw = "```json\n" + JSON.stringify(validResumeContent) + "\n```";
    const parsed = parseArtifactContent("resume", raw);
    expect((parsed as { fullName: string }).fullName).toBe("Maya Chen");
  });

  test("throws coded error on non-JSON", () => {
    expect(() => parseArtifactContent("resume", "Great resume coming right up!")).toThrow(
      "ARTIFACT_CONTENT_INVALID_OUTPUT:NOT_JSON",
    );
  });

  test("throws coded error on schema violation", () => {
    expect(() => parseArtifactContent("deck", JSON.stringify({ title: "x" }))).toThrow(
      "ARTIFACT_CONTENT_INVALID_OUTPUT",
    );
  });
});

describe("buildArtifactContentPrompt", () => {
  test("includes learner profile, assessment, playbook, and evidence", () => {
    const prompt = buildArtifactContentPrompt({ kind: "resume_pdf", context: baseContext() });
    expect(prompt).toContain("Maya Chen");
    expect(prompt).toContain("Growth Marketing Manager");
    expect(prompt).toContain("54");
    expect(prompt).toContain("No automated workflow");
    expect(prompt).toContain("Content Systems");
    expect(prompt).toContain("Show the target audience.");
    expect(prompt).toContain("https://example.com/demo");
    expect(prompt).toContain("Ran the scoring workflow on 25 accounts.");
    // Grounding instruction
    expect(prompt.toLowerCase()).toContain("never invent");
  });

  test("website prompt asks for sections; deck prompt asks for speaker notes", () => {
    expect(buildArtifactContentPrompt({ kind: "website", context: baseContext() })).toContain('"sections"');
    expect(buildArtifactContentPrompt({ kind: "pptx", context: baseContext() })).toContain("speakerNotes");
  });

  /**
   * Live E2E fix (2026-07-07 night, finding #4): a skip-ahead artifact with
   * only step-1 evidence claimed "all five interview transcripts included".
   * When the generation context has incomplete steps, the prompt must carry a
   * hard grounded-only constraint: claim ONLY what the evidence contains and
   * never assert deliverables (transcripts, outputs) from unfinished steps.
   */
  test("only-step-1 evidence (skip-ahead) adds a hard grounded-only constraint", () => {
    const context = baseContext(); // 3 playbook steps, only step 1 completed
    const prompt = buildArtifactContentPrompt({ kind: "pdf", context });
    expect(prompt).toContain("INCOMPLETE EVIDENCE");
    expect(prompt).toContain("Only 1 of 3 playbook steps");
    // The unfinished steps are named so the model knows what NOT to claim.
    expect(prompt).toContain("Run the module on a real workflow.");
    expect(prompt).toContain("Package the result.");
    // Explicit prohibitions on inventing non-existent deliverables.
    expect(prompt.toLowerCase()).toContain("do not claim");
    expect(prompt.toLowerCase()).toContain("transcripts");
    expect(prompt.toLowerCase()).toContain("planned next steps");
  });

  test("the grounded-only constraint applies to every generatable kind", () => {
    for (const kind of ["website", "resume_pdf", "resume_docx", "pptx", "pdf"]) {
      expect(buildArtifactContentPrompt({ kind, context: baseContext() })).toContain("INCOMPLETE EVIDENCE");
    }
  });

  test("no evidence at all still triggers the incomplete-evidence constraint", () => {
    const context = baseContext();
    context.evidence.completedSteps = [];
    const prompt = buildArtifactContentPrompt({ kind: "pdf", context });
    expect(prompt).toContain("INCOMPLETE EVIDENCE");
    expect(prompt).toContain("Only 0 of 3 playbook steps");
  });

  test("complete evidence does NOT add the incomplete-evidence constraint", () => {
    const context = baseContext();
    context.evidence.completedSteps = context.module.steps.map((title) => ({
      title,
      completedAt: "2026-07-07T00:00:00.000Z",
    }));
    const prompt = buildArtifactContentPrompt({ kind: "pdf", context });
    expect(prompt).not.toContain("INCOMPLETE EVIDENCE");
  });
});

describe("generateArtifactContent", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("throws OPENAI_CONFIG_MISSING without an API key and never calls OpenAI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateArtifactContent({ kind: "website", context: baseContext() })).rejects.toThrow(
      "OPENAI_CONFIG_MISSING",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns validated website content from a successful response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(okOpenAiResponse(validWebsiteContent));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateArtifactContent({ kind: "website", context: baseContext() });
    expect(result.contentKind).toBe("website");
    expect((result.content as { title: string }).title).toContain("Maya Chen");
    expect(result.model).toBe("gpt-4.1-mini");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.text?.format?.type).toBe("json_object");
    expect(body.input).toContain("Campaign Brief System");
  });

  test("hard-fails on invalid output with no placeholder fallback", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okOpenAiResponse({ nope: true })));

    await expect(generateArtifactContent({ kind: "pptx", context: baseContext() })).rejects.toThrow(
      "ARTIFACT_CONTENT_INVALID_OUTPUT",
    );
  });

  test("propagates upstream HTTP failures loudly", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom", json: async () => ({}) }),
    );

    await expect(generateArtifactContent({ kind: "pdf", context: baseContext() })).rejects.toThrow(
      "OPENAI_RESPONSE_FAILED:500",
    );
  });
});
