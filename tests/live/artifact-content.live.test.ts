/**
 * LIVE sanity check for artifact content generation — hits the real OpenAI API.
 *
 * Not part of `pnpm test` (unit) or `pnpm test:integration`. Run explicitly:
 *
 *   pnpm vitest run tests/live/artifact-content.live.test.ts
 *
 * Uses OPENAI_API_KEY from the environment, falling back to the repo root `.env`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { generateArtifactContent, type ArtifactGenerationContext, type ResumeContent } from "@aitutor/shared";

function loadRootEnv() {
  try {
    const raw = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!process.env[key]) {
        process.env[key] = value.replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch {
    // No .env file; rely on the process environment.
  }
}

function liveContext(): ArtifactGenerationContext {
  return {
    learner: {
      name: "Maya Chen",
      headline: "Growth Marketing Manager",
      careerPathId: "marketing-seo",
      careerPathName: "Marketing & SEO",
      goals: ["upskill_current_job", "showcase_for_job"],
      bio: "Growth marketer at a 60-person B2B SaaS company running paid acquisition, lifecycle email in HubSpot, and monthly reporting decks.",
    },
    assessment: {
      readinessScore: 54,
      headline: "Solid marketing instincts, but your AI usage is still ad hoc.",
      summary:
        "You use ChatGPT for copy variants and outlines but have not systematized AI into your campaign production workflow.",
      topGaps: [
        {
          title: "No automated campaign workflow",
          whyItMatters: "AI-native marketers are expected to run brief-to-launch pipelines.",
          marketImpact: "high",
        },
        {
          title: "No output verification habit",
          whyItMatters: "Unchecked AI output erodes stakeholder trust.",
          marketImpact: "medium",
        },
      ],
    },
    module: {
      moduleTitle: "AI Keyword Clustering",
      whyThisModule:
        "This module gives you one concrete growth workflow you can turn into proof quickly, which is better than consuming more generic AI content.",
      expectedOutput: "A campaign brief, content system, or SEO asset set tied to one measurable marketing goal.",
      proofChecklist: [
        "Show the target audience or query set.",
        "Show the AI-assisted content or clustering output.",
        "State the metric or workflow improvement you expect to move.",
      ],
      steps: [
        "Pick one campaign, content cluster, or search theme.",
        "Run the module on that real workflow instead of a made-up example.",
        "Package the result as a reusable system you can explain publicly.",
      ],
    },
    project: {
      title: "AI Keyword Clustering System",
      slug: "ai-keyword-clustering-system",
      description: "Reusable keyword clustering workflow for our Q3 landing-page sprint.",
    },
    evidence: {
      completedSteps: [
        { title: "Pick one campaign, content cluster, or search theme.", completedAt: "2026-07-06T18:00:00.000Z" },
        { title: "Run the module on that real workflow instead of a made-up example.", completedAt: "2026-07-07T09:30:00.000Z" },
      ],
      proofArtifacts: [
        {
          kind: "proof_link",
          url: "https://docs.google.com/spreadsheets/d/example",
          note: "Clustered 1,400 search queries into 12 intent groups with a Python + GPT workflow",
        },
      ],
      buildNotes: [
        "Clustered the Q3 query export; 12 intent groups; briefed 3 landing pages from the top clusters.",
        "Added a review pass that flags clusters with mixed intent before briefs are written.",
      ],
    },
  };
}

describe("LIVE artifact content generation", () => {
  test(
    "generates real resume content from the real OpenAI API",
    async () => {
      loadRootEnv();
      expect(process.env.OPENAI_API_KEY, "OPENAI_API_KEY missing — set it or add it to .env").toBeTruthy();

      const result = await generateArtifactContent({ kind: "resume_pdf", context: liveContext() });

      // eslint-disable-next-line no-console
      console.log("LIVE_ARTIFACT_CONTENT_JSON_START");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
      // eslint-disable-next-line no-console
      console.log("LIVE_ARTIFACT_CONTENT_JSON_END");

      expect(result.contentKind).toBe("resume");
      const content = result.content as ResumeContent;
      expect(content.fullName).toBe("Maya Chen");
      expect(content.experienceBullets.length).toBeGreaterThanOrEqual(3);
      expect(content.skills.length).toBeGreaterThanOrEqual(3);
      expect(content.aiProof.length).toBeGreaterThanOrEqual(1);
    },
    120_000,
  );
});
