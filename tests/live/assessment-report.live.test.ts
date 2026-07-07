/**
 * LIVE sanity check for the LLM assessment report — hits the real OpenAI API.
 *
 * Not part of `pnpm test` (unit) or `pnpm test:integration`. Run explicitly:
 *
 *   pnpm vitest run tests/live/assessment-report.live.test.ts
 *
 * Uses OPENAI_API_KEY from the environment, falling back to the repo root
 * `.env`. As of 2026-07-07 both repo keys (root `.env` and
 * `apps/web/.env.local`) return 401 — rotate the key before running.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { computeDeterministicAssessmentScore, generateAssessmentReport } from "@/lib/assessment-report";

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

describe("LIVE assessment report generation", () => {
  test(
    "generates a real report from the real OpenAI API",
    async () => {
      loadRootEnv();
      expect(process.env.OPENAI_API_KEY, "OPENAI_API_KEY missing — set it or add it to .env").toBeTruthy();

      const answers = [
        { questionId: "ai_tool_frequency", value: 3 },
        { questionId: "prompt_skill", value: 4 },
        { questionId: "workflow_automation", value: 2 },
        { questionId: "ai_judgment", value: 3 },
        { questionId: "ai_artifacts", value: 2 },
      ];

      const result = await generateAssessmentReport({
        role: {
          careerPathId: "marketing-seo",
          careerCategoryLabel: "Marketing",
          jobTitle: "Growth Marketing Manager",
          yearsExperience: "5-10",
          companySize: "small",
          situation: "employed",
        },
        goals: ["upskill_current_job", "showcase_for_job"],
        aiComfort: 3,
        answers,
        linkedinUrl: null,
        resumeText:
          "Growth marketing manager at a 60-person B2B SaaS company. I run paid acquisition (Google, LinkedIn), lifecycle email in HubSpot, and monthly reporting decks. I use ChatGPT for ad copy variants and blog outlines but everything else is manual. Recently started experimenting with a keyword clustering script a contractor built.",
        deterministicScore: computeDeterministicAssessmentScore(answers),
      });

      // eslint-disable-next-line no-console
      console.log("LIVE_REPORT_JSON_START");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
      // eslint-disable-next-line no-console
      console.log("LIVE_REPORT_JSON_END");

      expect(result.report.readinessScore).toBeGreaterThanOrEqual(0);
      expect(result.report.readinessScore).toBeLessThanOrEqual(100);
      expect(result.report.gaps.length).toBeGreaterThanOrEqual(1);
      expect(result.report.thirtyDayPlan.length).toBeGreaterThanOrEqual(1);
    },
    120_000,
  );
});
