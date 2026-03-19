import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const landingTemplatePath = path.resolve(process.cwd(), "mockups/high_fidelity/index.html");
const homePagePath = path.resolve(process.cwd(), "apps/web/app/page.tsx");

describe("landing page copy", () => {
  test("uses the new career-focused feature and pricing copy", () => {
    const template = readFileSync(landingTemplatePath, "utf8");
    const featureHeadings = [
      "Career-Based AI Skill Modules",
      "24/7 AI Tutor for Your Career",
      "Daily AI News for Your Career",
      "Build Your AI Presence",
    ];

    expect(template).toContain("Build AI skills that actually fit your career.");
    expect(template).toContain("<title>My AI Skill Tutor | AI Upskilling for Working Professionals</title>");
    expect(template).toContain("Career Builder");
    expect(template).toContain("$49.99");
    expect(template).toContain("7-day free trial");
    expect(template).toContain("Start 7-Day Free Trial");
    expect(template).toContain(">Features<");
    expect(template).not.toContain("System Verified Proof");
    expect(template).not.toContain(">Public Proof<");

    const featureIndexes = featureHeadings.map((heading) => template.indexOf(heading));
    expect(featureIndexes.every((index) => index >= 0)).toBe(true);
    expect(featureIndexes).toEqual([...featureIndexes].sort((a, b) => a - b));
  });

  test("homepage metadata matches the new positioning", () => {
    const source = readFileSync(homePagePath, "utf8");

    expect(source).toContain("Build AI skills for your career with personalized modules, a 24/7 tutor, daily AI news, and content that helps you show your progress.");
    expect(source).toContain("Personalized AI learning for your career with role-based modules, always-on tutor support, daily AI updates, and visible progress.");
  });
});
