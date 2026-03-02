import { describe, expect, test } from "vitest";
import { CAREER_PATHS, getEmployerFilterFacets, getOnboardingCareerOptions } from "../../packages/shared/src/matrix";

describe("matrix contract", () => {
  test("onboarding options are derived from matrix career paths", () => {
    const options = getOnboardingCareerOptions();
    expect(options.length).toBe(CAREER_PATHS.length);
    expect(options.map((entry) => entry.id).sort()).toEqual(CAREER_PATHS.map((entry) => entry.id).sort());
  });

  test("employer facets include matrix roles/modules/tools", () => {
    const facets = getEmployerFilterFacets();
    expect(facets.careerPaths.length).toBe(CAREER_PATHS.length);
    expect(facets.modules.length).toBeGreaterThanOrEqual(CAREER_PATHS.length * 3);
    expect(facets.tools.length).toBeGreaterThan(10);
    expect(facets.roles.length).toBeGreaterThan(10);
  });
});
