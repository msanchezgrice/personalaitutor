import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EXAMPLE_CAREER_MAP } from "@aitutor/shared";
import {
  buildProofSiteDraftPrompt,
  draftProofSite,
  findProofSiteDraftGroundingIssue,
  parseProofSiteDraft,
} from "@/lib/proof/site-draft";

const PROFILE = { name: "Maya Ortiz" };

const GOOD = {
  tagline: "I turn launch plans into AI workflows and player emails into brand-voice prompts.",
  bio: "I spent 7 years in games marketing planning launches, writing player emails and growing a community. Now I build AI launch workflows and brand-voice prompts.",
  translations: [
    { before: "Planned 4 global game launches", now: "Builds AI launch workflows" },
    { before: "Wrote player emails to 12M players", now: "Writes brand-voice prompts" },
    { before: "Grew a 90k-member Discord community", now: "Designs community agents" },
  ],
};

function mockOpenAi(...payloads: unknown[]) {
  const fetchMock = vi.fn();
  for (const payload of payloads) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ output_text: typeof payload === "string" ? payload : JSON.stringify(payload) }),
      text: async () => "",
    });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("parseProofSiteDraft", () => {
  test("accepts valid JSON, with or without code fences", () => {
    expect(parseProofSiteDraft(JSON.stringify(GOOD))).toEqual(GOOD);
    expect(parseProofSiteDraft("```json\n" + JSON.stringify(GOOD) + "\n```").tagline).toBe(GOOD.tagline);
  });

  test("rejects non-JSON and schema violations with a coded error", () => {
    expect(() => parseProofSiteDraft("not json")).toThrow("PROOF_SITE_DRAFT_INVALID_OUTPUT:NOT_JSON");
    expect(() => parseProofSiteDraft(JSON.stringify({ ...GOOD, bio: "too short" }))).toThrow("PROOF_SITE_DRAFT_INVALID_OUTPUT:bio");
    expect(() => parseProofSiteDraft(JSON.stringify({ ...GOOD, translations: [GOOD.translations[0]] }))).toThrow(
      "PROOF_SITE_DRAFT_INVALID_OUTPUT:translations",
    );
  });
});

describe("grounding check", () => {
  test("a draft built from the map passes", () => {
    expect(findProofSiteDraftGroundingIssue(GOOD, EXAMPLE_CAREER_MAP, PROFILE)).toBeNull();
  });

  test("a number that is not in the map fails", () => {
    const draft = { ...GOOD, bio: `${GOOD.bio} I lifted retention by 40% across the portfolio.` };
    expect(findProofSiteDraftGroundingIssue(draft, EXAMPLE_CAREER_MAP, PROFILE)).toBe("UNGROUNDED_NUMBER");
  });

  test("a translation that is not on the map fails", () => {
    const draft = { ...GOOD, translations: [...GOOD.translations.slice(0, 2), { before: "Managed a team of engineers", now: "Leads platform engineering" }] };
    expect(findProofSiteDraftGroundingIssue(draft, EXAMPLE_CAREER_MAP, PROFILE)).toBe("UNGROUNDED_TRANSLATION");
  });

  test("the prompt carries only map facts and the grounding rules", () => {
    const prompt = buildProofSiteDraftPrompt({ map: EXAMPLE_CAREER_MAP, profile: PROFILE });
    expect(prompt).toContain("Go-to-Market Engineer");
    expect(prompt).toContain("Planned 4 global game launches");
    expect(prompt).toContain("Do not name any employer");
    expect(prompt).toContain("Do not add any number");
    expect(prompt).not.toContain("Kiteborne");
    expect(buildProofSiteDraftPrompt({ map: EXAMPLE_CAREER_MAP, profile: PROFILE, strict: true })).toContain("Your last answer broke these rules");
  });
});

describe("draftProofSite", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("returns the draft plus title and previous role from the map", async () => {
    const fetchMock = mockOpenAi(GOOD);
    const result = await draftProofSite({ map: EXAMPLE_CAREER_MAP, profile: PROFILE });
    expect(result.draft).toEqual(GOOD);
    expect(result.newTitle).toBe("Go-to-Market Engineer");
    expect(result.previousRole).toBe("Senior Marketing Manager");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text.format).toEqual({ type: "json_object" });
  });

  test("retries once with a stricter prompt when the first draft is ungrounded", async () => {
    const fetchMock = mockOpenAi({ ...GOOD, tagline: "I grew revenue 300% with AI launch workflows." }, GOOD);
    const result = await draftProofSite({ map: EXAMPLE_CAREER_MAP, profile: PROFILE });
    expect(result.draft.tagline).toBe(GOOD.tagline);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).input).toContain("Your last answer broke these rules");
  });

  test("hard-fails when both attempts are ungrounded", async () => {
    const bad = { ...GOOD, bio: `${GOOD.bio} Shipped 25 launches.` };
    mockOpenAi(bad, bad);
    await expect(draftProofSite({ map: EXAMPLE_CAREER_MAP, profile: PROFILE })).rejects.toThrow("PROOF_SITE_DRAFT_INVALID_OUTPUT:UNGROUNDED_NUMBER");
  });

  test("hard-fails on invalid JSON without a retry", async () => {
    const fetchMock = mockOpenAi("{ nope");
    await expect(draftProofSite({ map: EXAMPLE_CAREER_MAP, profile: PROFILE })).rejects.toThrow("PROOF_SITE_DRAFT_INVALID_OUTPUT:NOT_JSON");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("maps a missing key to OPENAI_CONFIG_MISSING", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(draftProofSite({ map: EXAMPLE_CAREER_MAP, profile: PROFILE })).rejects.toThrow("OPENAI_CONFIG_MISSING");
  });

  test("passes provider failures through as errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}), text: async () => "upstream" }));
    await expect(draftProofSite({ map: EXAMPLE_CAREER_MAP, profile: PROFILE })).rejects.toThrow("OPENAI_RESPONSE_FAILED:500");
  });
});
