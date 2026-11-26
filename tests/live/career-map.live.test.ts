/**
 * LIVE check for career map generation: hits the real OpenAI API.
 *
 * Not part of `pnpm test`. Run explicitly:
 *
 *   pnpm vitest run tests/live/career-map.live.test.ts
 *
 * Uses OPENAI_API_KEY from the environment, falling back to the repo root
 * `.env`. Skipped when no key is available.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  CAREER_MAP_TITLE_IDS,
  EXAMPLE_CAREER_MAP_INPUT,
  careerMapSchema,
  isEvidenceGrounded,
} from "@aitutor/shared";
import { extractNumbers, generateCareerMap } from "@/lib/career-map/generate";

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

loadRootEnv();
const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());

describe.skipIf(!hasKey)("LIVE career map generation", () => {
  test(
    "maps the example résumé to a grounded catalog title",
    async () => {
      const result = await generateCareerMap({ inputText: EXAMPLE_CAREER_MAP_INPUT });

      // eslint-disable-next-line no-console
      console.log("LIVE_CAREER_MAP_JSON_START");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
      // eslint-disable-next-line no-console
      console.log("LIVE_CAREER_MAP_JSON_END");

      const { map } = result;
      expect(careerMapSchema.safeParse(map).success).toBe(true);
      expect(CAREER_MAP_TITLE_IDS).toContain(map.primary.titleId);
      const ids = [map.primary.titleId, ...map.alternates.map((entry) => entry.titleId)];
      expect(new Set(ids).size).toBe(3);

      expect(map.translations.length).toBeGreaterThanOrEqual(3);
      const inputNumbers = new Set(extractNumbers(EXAMPLE_CAREER_MAP_INPUT));
      for (const translation of map.translations) {
        expect(isEvidenceGrounded(translation.evidence, EXAMPLE_CAREER_MAP_INPUT)).toBe(true);
        for (const value of extractNumbers(`${translation.before} ${translation.now}`)) {
          expect(inputNumbers.has(value), `invented number ${value} in "${translation.before}"`).toBe(true);
        }
      }

      expect(map.person.previousTitle).toMatch(/marketing manager/i);
      expect(map.gaps.length).toBeGreaterThanOrEqual(2);
    },
    180_000,
  );
});
