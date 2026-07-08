import { describe, expect, test } from "vitest";
import {
  CAREER_PATHS,
  getEmployerFilterFacets,
  getModuleTracksForCareerPath,
  getOnboardingCareerOptions,
  orderModuleTracksByPlan,
} from "../../packages/shared/src/matrix";

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

describe("orderModuleTracksByPlan (spine phase 2)", () => {
  const pmTracks = getModuleTracksForCareerPath("product-management");
  // Catalog order: Synthetic User Research, AI Wireframing, PRD Generation, Sentiment Analysis.

  test("reorders tracks to the plan's per-user module sequence", () => {
    const ordered = orderModuleTracksByPlan(pmTracks, [
      "PRD Generation",
      "Sentiment Analysis",
      "Synthetic User Research",
      "AI Wireframing",
    ]);
    expect(ordered.map((track) => track.title)).toEqual([
      "PRD Generation",
      "Sentiment Analysis",
      "Synthetic User Research",
      "AI Wireframing",
    ]);
  });

  test("plan-named tracks come first; the rest keep catalog order; matching is case-insensitive", () => {
    const ordered = orderModuleTracksByPlan(pmTracks, ["prd generation"]);
    expect(ordered.map((track) => track.title)).toEqual([
      "PRD Generation",
      "Synthetic User Research",
      "AI Wireframing",
      "Sentiment Analysis",
    ]);
  });

  test("unknown plan titles and an empty plan leave the catalog order untouched", () => {
    const catalogOrder = pmTracks.map((track) => track.title);
    expect(orderModuleTracksByPlan(pmTracks, ["Quantum Basket Weaving"]).map((track) => track.title)).toEqual(
      catalogOrder,
    );
    expect(orderModuleTracksByPlan(pmTracks, []).map((track) => track.title)).toEqual(catalogOrder);
    expect(orderModuleTracksByPlan(pmTracks, [null, undefined, "  "]).map((track) => track.title)).toEqual(
      catalogOrder,
    );
  });

  test("does not mutate the input array", () => {
    const before = pmTracks.map((track) => track.title);
    orderModuleTracksByPlan(pmTracks, ["Sentiment Analysis"]);
    expect(pmTracks.map((track) => track.title)).toEqual(before);
  });
});
