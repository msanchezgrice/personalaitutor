/**
 * LIVE sanity check for event-driven re-scoring — one real gpt-4.1-mini call
 * interpreting a fixture briefing against a fixture assessment report.
 *
 * Not part of `pnpm test`. Run explicitly:
 *
 *   pnpm vitest run tests/live/briefing-rescore.live.test.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { generateBriefingRescore } from "@aitutor/shared";

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

describe("LIVE briefing rescore", () => {
  test(
    "one real re-scoring call against a fixture report",
    async () => {
      loadRootEnv();
      expect(process.env.OPENAI_API_KEY, "OPENAI_API_KEY missing — set it or add it to .env").toBeTruthy();

      const { rescore, model } = await generateBriefingRescore({
        briefing: {
          date: new Date().toISOString().slice(0, 10),
          careerPathName: "Marketing & SEO",
          topStory: {
            headline: "OpenAI ships an agent that drafts and publishes SEO content end-to-end",
            summary:
              "The new agent takes a keyword list, drafts long-form articles, and can publish directly to a CMS. Early testers report 10x content throughput.",
            source: "TechCrunch AI",
            url: "https://techcrunch.com/example/openai-seo-agent",
          },
          quickHits: [
            {
              headline: "Google updates search quality guidance for AI-written pages",
              summary: "New documentation clarifies how mass-produced AI content is treated in ranking.",
              source: "Search Engine Land",
              url: "https://searchengineland.com/example/quality-guidance",
            },
          ],
        },
        report: {
          readinessScore: 52,
          headline: "Solid marketer, thin AI execution",
          gaps: [
            {
              title: "Programmatic SEO automation",
              whyItMatters: "Manual content production is being priced out of the market.",
              marketImpact: "high",
            },
            {
              title: "AI copy evaluation",
              whyItMatters: "Publishing at volume without QA erodes brand trust.",
              marketImpact: "medium",
            },
          ],
        },
        careerPathName: "Marketing & SEO",
      });

      // Structure is zod-validated inside generateBriefingRescore; assert the
      // grounding contract on top.
      expect(rescore.dailyAction.minutes).toBeGreaterThanOrEqual(10);
      expect(rescore.dailyAction.minutes).toBeLessThanOrEqual(20);
      expect(["programmatic seo automation", "ai copy evaluation"]).toContain(
        rescore.dailyAction.gapRef.trim().toLowerCase(),
      );
      expect(Math.abs(rescore.scoreDelta)).toBeLessThanOrEqual(3);

      console.log("[live] model:", model);
      console.log("[live] dailyAction:", JSON.stringify(rescore.dailyAction, null, 2));
      console.log("[live] scoreDelta:", rescore.scoreDelta, "-", rescore.scoreDeltaReason);
      console.log("[live] gapAdjustments:", JSON.stringify(rescore.gapAdjustments, null, 2));
    },
    120_000,
  );
});
