import { beforeEach, describe, expect, test, vi } from "vitest";
import React, { createElement } from "react";
// eslint-disable-next-line import/no-relative-packages -- matches existing test convention
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { createProject, recordProjectArtifact, resetStateForTests, upsertUserProfile, VOICE_MODEL_METHOD_LABEL } from "@aitutor/shared";

/**
 * /u/[handle] branches: a learner with a proof site gets the new page, a
 * learner without one keeps the existing page, maya-ortiz is the static
 * example, alex-chen-ai is unchanged. The voice model and build log sections
 * belong to other workstreams and are stubbed here to check the wiring.
 */

// Foundation components (components/remap/*) rely on the automatic JSX runtime;
// vitest compiles JSX with the classic one, so give them a global React.
vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({ getAuthSeed: vi.fn(async () => null as { userId: string } | null) }));
vi.mock("@/lib/auth", () => ({ getAuthSeed: mocks.getAuthSeed }));
vi.mock("@/components/proof/profile-voice-model-section", () => ({
  ProfileVoiceModelSection: (props: { learnerProfileId: string; handle: string; displayName: string }) =>
    createElement("section", { "data-stub": "voice-model", "data-props": JSON.stringify(props) }),
}));
vi.mock("@/components/proof/profile-build-log-section", () => ({
  ProfileBuildLogSection: (props: { learnerProfileId: string; handle: string; displayName: string }) =>
    createElement("section", { "data-stub": "build-log", "data-props": JSON.stringify(props) }),
}));

import PublicProfilePage, { generateMetadata } from "@/app/u/[handle]/page";
import { resetProofSiteStateForTests, upsertProofSite } from "@/lib/proof/site-store";
import { initialsFor, routeFromTitle } from "@/components/proof/site-page";

async function render(handle: string) {
  const element = await PublicProfilePage({ params: Promise.resolve({ handle }) });
  return renderToStaticMarkup(element);
}

function seedLearner(options: { published?: boolean } = {}) {
  return upsertUserProfile({
    id: "learner-site-1",
    handle: "jordan-lee",
    name: "Jordan Lee",
    headline: "Model Evaluator",
    bio: "Legacy bio that the old page shows.",
    careerPathId: "quality-assurance",
    published: options.published ?? true,
    skills: [],
    tools: [],
    socialLinks: {},
  });
}

async function seedSite(overrides: Partial<Parameters<typeof upsertProofSite>[0]> = {}) {
  return upsertProofSite({
    learnerProfileId: "learner-site-1",
    careerMapId: null,
    newTitle: "Model Evaluator",
    previousRole: "QA Lead at a mobile studio, 2017 to 2025",
    tagline: "I write the tests that show where an AI system fails.",
    bio: "Eight years of game QA. Now I build evaluation sets and grading rules for AI systems.",
    translations: [
      { before: "Wrote regression suites for 3 live games", now: "Writes eval sets" },
      { before: "Triaged crash reports with engineers", now: "Triages model failures" },
    ],
    contactEmail: "jordan@example.com",
    linkedinUrl: "https://www.linkedin.com/in/jordan-lee-example/",
    ...overrides,
  });
}

beforeEach(() => {
  resetStateForTests();
  resetProofSiteStateForTests();
  mocks.getAuthSeed.mockResolvedValue(null);
});

describe("learner with a proof site", () => {
  test("renders the new page: hero, route strip, translations, sections, contact and JSON-LD", async () => {
    seedLearner();
    await seedSite();
    const html = await render("jordan-lee");

    expect(html).toContain('data-testid="proof-site-page"');
    expect(html).toContain('data-variant="public"');
    expect(html).toContain("A proof page on");
    expect(html).toContain("Map your own career");
    expect(html).toContain(">Jordan Lee</h1>");
    expect(html).toContain(">JL</div>");
    expect(html).toContain("Model Evaluator");
    expect(html).toContain("I write the tests that show where an AI system fails. Previously QA Lead at a mobile studio, 2017 to 2025.");
    expect(html).toContain("Eight years of game QA.");
    // Route strip uses the role part of the previous role.
    expect(html).toContain("QA Lead</span>");
    expect(html).toContain("Wrote regression suites for 3 live games");
    expect(html).toContain("Writes eval sets");
    // Contact: button to the footer, visible copyable address, no form.
    expect(html).toContain('href="#contact"');
    expect(html).toContain("Contact Jordan");
    expect(html).toContain('href="mailto:jordan@example.com"');
    expect(html).toContain(">jordan@example.com</a>");
    expect(html).toContain("Copy address");
    expect(html).not.toContain("<form");
    expect(html).toContain("https://www.linkedin.com/in/jordan-lee-example/");
    // Other workstreams' sections are rendered with the learner's ids.
    expect(html).toContain('data-stub="voice-model"');
    expect(html).toContain('data-stub="build-log"');
    expect(html).toContain("&quot;learnerProfileId&quot;:&quot;learner-site-1&quot;");
    expect(html).toContain("&quot;handle&quot;:&quot;jordan-lee&quot;");
    // Footer and JSON-LD.
    expect(html).toContain("Jordan Lee wrote and published this page with My AI Skill Tutor.");
    expect(html).toContain('"@type":"Person"');
    expect(html).toContain('"jobTitle":"Model Evaluator"');
    // No legacy sections, no example label.
    expect(html).not.toContain("Verified Skill Stack");
    expect(html).not.toContain("Example profile");
    // "Things I built" is omitted with no public artifacts.
    expect(html).not.toContain("Things I built");
  });

  test("lists real projects with public artifacts under Things I built", async () => {
    const profile = seedLearner();
    await seedSite();
    const project = createProject({ userId: profile.id, title: "Eval Harness", description: "Grades chatbot answers against a rubric." });
    if (!project) throw new Error("TEST_PROJECT_CREATE_FAILED");
    recordProjectArtifact({
      projectId: project.id,
      userId: profile.id,
      kind: "pdf",
      url: `/generated/${project.slug}/pdf-1.pdf`,
      logMessage: "Generated brief",
      metadata: { source: "generated_artifact", contentId: "content-site-1" },
    });
    const placeholderOnly = createProject({ userId: profile.id, title: "Placeholder Project", description: "Nothing real." });
    if (!placeholderOnly) throw new Error("TEST_PROJECT_CREATE_FAILED");
    recordProjectArtifact({
      projectId: placeholderOnly.id,
      userId: profile.id,
      kind: "website",
      url: `/generated/${placeholderOnly.slug}/website-1.html`,
      logMessage: "Legacy",
      metadata: {},
    });

    const html = await render("jordan-lee");
    expect(html).toContain("Things I built");
    expect(html).toContain("Eval Harness");
    expect(html).toContain(`/u/jordan-lee/projects/${project.slug}/`);
    expect(html).toContain(`/generated/${project.slug}/pdf-1.pdf`);
    expect(html).not.toContain("Placeholder Project");
  });

  test("hides contact and LinkedIn when not set, and the route strip without a previous role", async () => {
    seedLearner();
    await seedSite({ contactEmail: null, linkedinUrl: null, previousRole: null });
    const html = await render("jordan-lee");
    expect(html).not.toContain("Contact Jordan");
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain(">LinkedIn<");
    expect(html).not.toContain("Previously");
    // Without a route strip the translation list shows its column headings.
    expect(html).toContain(">Before</span>");
  });

  test("unpublished: 404 for visitors, private preview for the owner, no JSON-LD", async () => {
    seedLearner({ published: false });
    await seedSite();
    await expect(render("jordan-lee")).rejects.toThrow();

    mocks.getAuthSeed.mockResolvedValue({ userId: "learner-site-1" });
    const html = await render("jordan-lee");
    expect(html).toContain('data-variant="preview"');
    expect(html).toContain("Private preview");
    expect(html).not.toContain("application/ld+json");
  });

  test("metadata uses the new title and tagline", async () => {
    seedLearner();
    await seedSite();
    const metadata = await generateMetadata({ params: Promise.resolve({ handle: "jordan-lee" }) });
    expect(metadata.title).toBe("Jordan Lee, Model Evaluator | My AI Skill Tutor");
    expect(metadata.description).toBe("I write the tests that show where an AI system fails.");
    expect(metadata.alternates?.canonical).toBe("/u/jordan-lee");
    expect(JSON.stringify(metadata.openGraph)).toContain("/api/og/profile/jordan-lee");
  });
});

describe("learner without a proof site", () => {
  test("renders the existing page exactly as before", async () => {
    seedLearner();
    const html = await render("jordan-lee");
    expect(html).not.toContain('data-testid="proof-site-page"');
    expect(html).toContain("Public proof profile");
    expect(html).toContain("Legacy bio that the old page shows.");
    expect(html).toContain("Verified Skill Stack");
    const metadata = await generateMetadata({ params: Promise.resolve({ handle: "jordan-lee" }) });
    expect(metadata.title).toBe("Jordan Lee | My AI Skill Tutor Profile");
  });

  test("alex-chen-ai stays the old example page", async () => {
    const html = await render("alex-chen-ai");
    expect(html).not.toContain('data-testid="proof-site-page"');
    expect(html).toContain("Example profile");
    expect(html).toContain("AI-readiness score");
  });
});

describe("maya-ortiz example", () => {
  test("renders the new layout from the example map, clearly labelled", async () => {
    const html = await render("maya-ortiz");
    expect(html).toContain('data-variant="example"');
    expect(html).toContain('data-testid="example-profile-label"');
    expect(html).toContain("Example profile");
    expect(html).toContain(">Maya Ortiz</h1>");
    expect(html).toContain("Go-to-Market Engineer");
    expect(html).toContain("Previously Senior Marketing Manager at Kiteborne Games, 2018 to 2025.");
    expect(html).toContain("Planned 4 global game launches");
    expect(html).toContain("Builds AI launch workflows");
    expect(html).toContain("Launch-day agent workflow");
    expect(html).toContain("Maya reviews");
    // Static model comparison with the honest method label.
    expect(html).toContain("Try my model");
    expect(html).toContain("maya-voice-v1");
    expect(html).toContain("Exciting update coming soon! Season 4 arrives this Friday with new content.");
    expect(html).toContain("Squad up. Season 4 drops Friday.");
    expect(html).toContain(VOICE_MODEL_METHOD_LABEL);
    expect(html).toContain("gpt-4.1-mini");
    expect(html).toContain("24 launch emails");
    expect(html).toContain("the outputs below are fixed");
    // Three build log titles, not links to missing pages.
    expect(html).toContain("I turned our launch checklist into one agent workflow");
    expect(html).toContain("24 emails later, the model stopped saying “exciting”");
    expect(html).toContain("My studio closed. Here is the map I&#x27;m following");
    expect(html).not.toContain("/u/maya-ortiz/log/");
    // Fictional: says so, no live model form, no JSON-LD person, no other workstream sections.
    expect(html).toContain("Maya Ortiz and Kiteborne Games are fictional");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("application/ld+json");
    expect(html).not.toContain('data-stub="voice-model"');
    expect(html).not.toContain("linkedin.com");
  });

  test("metadata is labelled as an example", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ handle: "maya-ortiz" }) });
    expect(String(metadata.title)).toMatch(/^Example profile: Maya Ortiz, Go-to-Market Engineer/);
    expect(metadata.alternates?.canonical).toBe("/u/maya-ortiz");
  });
});

describe("helpers", () => {
  test("initials and route titles", () => {
    expect(initialsFor("Maya Ortiz")).toBe("MO");
    expect(initialsFor("cher")).toBe("C");
    expect(initialsFor("  ")).toBe("?");
    expect(routeFromTitle("Senior Marketing Manager at Kiteborne Games, 2018 to 2025")).toBe("Senior Marketing Manager");
    expect(routeFromTitle("Producer, 2019 to 2024")).toBe("Producer");
    expect(routeFromTitle(null)).toBeNull();
  });
});
