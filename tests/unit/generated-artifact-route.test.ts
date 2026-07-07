import { beforeEach, describe, expect, test } from "vitest";
import { createProject, resetStateForTests } from "@aitutor/shared";
import {
  persistArtifactContent,
  resetArtifactContentStateForTests,
} from "@/lib/artifact-content-store";
import { GET as generatedGet } from "../../apps/web/app/generated/[...slug]/route";

const userId = "user_test_0001";

function contextFor(...slug: string[]) {
  return { params: Promise.resolve({ slug }) };
}

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

describe("generated artifact route", () => {
  beforeEach(() => {
    resetStateForTests();
    resetArtifactContentStateForTests();
  });

  test("renders real website copy from persisted content", async () => {
    const project = createProject({ userId, title: "GEN_ROUTE_TEST", description: "route test" });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");

    const fileName = "website-123.html";
    const url = `/generated/${project.slug}/${fileName}`;
    await persistArtifactContent({
      projectId: project.id,
      learnerProfileId: userId,
      artifactUrl: url,
      kind: "website",
      contentKind: "website",
      model: "gpt-4.1-mini",
      content: {
        title: "Maya Chen — AI Workflow Proof",
        tagline: "Real campaigns, AI-assisted.",
        heroCta: "See the proof",
        sections: [
          { heading: "What I automated", body: "Campaign brief drafting.", bullets: ["60% faster briefs"] },
          { heading: "How it works", body: "Prompt pack plus structured review." },
          { heading: "Results", body: "Verified output quality." },
        ],
        footerNote: "Generated with My AI Skill Tutor.",
      },
    });

    const response = await generatedGet(request(url), contextFor(project.slug, fileName));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Maya Chen");
    expect(html).toContain("What I automated");
    expect(html).toContain("60% faster briefs");
    expect(html).toContain("Campaign brief drafting.");
    // No placeholder-only shell: real section content present, not just title+timestamp.
    expect(html).not.toContain("Generated project artifact.");
  });

  test("renders resume content into the DOCX writer", async () => {
    const project = createProject({ userId, title: "GEN_ROUTE_RESUME", description: "route test" });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");

    const fileName = "resume_docx-123.docx";
    const url = `/generated/${project.slug}/${fileName}`;
    await persistArtifactContent({
      projectId: project.id,
      learnerProfileId: userId,
      artifactUrl: url,
      kind: "resume_docx",
      contentKind: "resume",
      model: "gpt-4.1-mini",
      content: {
        fullName: "Maya Chen",
        headline: "Growth Marketing Manager | AI-Assisted Systems",
        summary: "Marketer who systematized AI into production.",
        experienceBullets: ["Automated brief drafting", "Built keyword clustering flow", "Introduced verification checklist"],
        skills: ["Prompting", "Automation", "SEO"],
        aiProof: ["Shipped one verified AI workflow artifact"],
      },
    });

    const response = await generatedGet(request(url), contextFor(project.slug, fileName));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("wordprocessingml");
    const bytes = Buffer.from(await response.arrayBuffer());
    // DOCX is a zip; document.xml is stored uncompressed by the writer, so text is findable.
    expect(bytes.includes(Buffer.from("Maya Chen"))).toBe(true);
    expect(bytes.includes(Buffer.from("Automated brief drafting"))).toBe(true);
  });

  test("renders deck content with one slide per content slide", async () => {
    const project = createProject({ userId, title: "GEN_ROUTE_DECK", description: "route test" });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");

    const fileName = "pptx-123.pptx";
    const url = `/generated/${project.slug}/${fileName}`;
    await persistArtifactContent({
      projectId: project.id,
      learnerProfileId: userId,
      artifactUrl: url,
      kind: "pptx",
      contentKind: "deck",
      model: "gpt-4.1-mini",
      content: {
        title: "AI Workflow Deck",
        subtitle: "Proof in four slides",
        slides: [
          { title: "SLIDE_ONE_TITLE", bullets: ["a", "b"], speakerNotes: "n1" },
          { title: "SLIDE_TWO_TITLE", bullets: ["c", "d"], speakerNotes: "n2" },
          { title: "SLIDE_THREE_TITLE", bullets: ["e", "f"], speakerNotes: "n3" },
          { title: "SLIDE_FOUR_TITLE", bullets: ["g", "h"], speakerNotes: "n4" },
        ],
      },
    });

    const response = await generatedGet(request(url), contextFor(project.slug, fileName));
    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.includes(Buffer.from("SLIDE_ONE_TITLE"))).toBe(true);
    expect(bytes.includes(Buffer.from("SLIDE_FOUR_TITLE"))).toBe(true);
    expect(bytes.includes(Buffer.from("slides/slide4.xml"))).toBe(true);
  });

  test("returns 404 for artifact URLs without persisted content — no placeholder rendering", async () => {
    const project = createProject({ userId, title: "GEN_ROUTE_MISSING", description: "route test" });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");

    const fileName = "website-999.html";
    const response = await generatedGet(
      request(`/generated/${project.slug}/${fileName}`),
      contextFor(project.slug, fileName),
    );
    expect(response.status).toBe(404);
  });

  test("demo slug keeps rendering without stored content", async () => {
    const response = await generatedGet(request("/generated/demo/website-1.html"), contextFor("demo", "website-1.html"));
    expect(response.status).toBe(200);
  });
});
