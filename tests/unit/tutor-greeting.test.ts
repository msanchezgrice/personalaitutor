import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { buildRecommendedModuleGuide } from "@aitutor/shared";
import {
  buildTutorSessionPrompt,
  resetTutorSessionStateForTests,
  startTutorSession,
} from "@/lib/tutor-session";

/**
 * F. A bare "hey" must not trigger a wall of instructions. Both tutor
 * prompts (session message + generic project chat) instruct the model to
 * answer greetings/short openers in 1-2 sentences and ask what the learner
 * is working on instead of dumping steps.
 */

const guide = buildRecommendedModuleGuide({
  careerPathId: "marketing-seo",
  moduleTitle: "Content Systems",
  jobTitle: "Growth Marketing Manager",
  primaryGoal: "upskill_current_job",
});

describe("tutor greeting behavior", () => {
  beforeEach(() => {
    resetTutorSessionStateForTests();
  });

  test("session prompt tells the model to keep greeting replies short", async () => {
    const session = await startTutorSession({
      projectId: "project_greeting_001",
      learnerProfileId: "user_greeting_001",
      guide,
    });

    const prompt = buildTutorSessionPrompt({
      session,
      guide,
      learner: { name: "Maya Chen", headline: "Growth Marketing Manager", goals: ["upskill_current_job"] },
      assessment: null,
      message: "hey",
    });

    expect(prompt).toContain("only a greeting or short opener");
    expect(prompt).toContain("1-2 sentences");
    // The full-coaching directive still applies to substantive messages.
    expect(prompt).toContain("Otherwise respond in <= 6 sentences");
  });

  test("generic project chat prompt has the same greeting rule", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "apps/web/lib/runtime.ts"),
      "utf8",
    );
    const start = source.indexOf("async function generateTutorReply");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 1600);
    expect(body).toContain("only a greeting or short opener");
    expect(body).toContain("1-2 sentences");
    expect(body).toContain("Otherwise respond in <= 6 sentences");
  });
});
