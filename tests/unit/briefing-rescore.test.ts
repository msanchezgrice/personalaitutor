import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  buildBriefingRescorePrompt,
  generateBriefingRescore,
  parseBriefingRescore,
  type BriefingRescoreInput,
} from "@aitutor/shared";

const INPUT: BriefingRescoreInput = {
  briefing: {
    date: "2026-07-07",
    careerPathName: "Marketing & SEO",
    topStory: {
      headline: "New bulk-content model ships",
      summary: "A model that automates long-form SEO content landed today.",
      source: "TechCrunch AI",
      url: "https://real.example.com/top",
    },
    quickHits: [
      {
        headline: "Keyword clustering agent released",
        summary: "Open-source keyword clustering agent.",
        source: "Hugging Face Blog",
        url: "https://real.example.com/hit",
      },
    ],
  },
  report: {
    readinessScore: 52,
    headline: "Solid marketer, thin AI execution",
    gaps: [
      { title: "Programmatic SEO automation", whyItMatters: "Manual SEO is being priced out.", marketImpact: "high" },
      { title: "AI copy evaluation", whyItMatters: "Volume without QA erodes brand.", marketImpact: "medium" },
    ],
  },
  careerPathName: "Marketing & SEO",
};

const VALID_OUTPUT = {
  gapAdjustments: [
    {
      gapTitle: "Programmatic SEO automation",
      direction: "up",
      reason: "Today's bulk-content model raises urgency for automation skills.",
    },
  ],
  scoreDelta: -1,
  scoreDeltaReason: "The bulk-content release automates part of this role's core output.",
  dailyAction: {
    title: "Run one blog post through the new bulk-content workflow and note quality gaps",
    minutes: 15,
    gapRef: "Programmatic SEO automation",
    artifactRef: null,
  },
};

describe("briefing rescore prompt", () => {
  test("prompt grounds the model in gaps, score, and briefing stories with URLs", () => {
    const prompt = buildBriefingRescorePrompt(INPUT);
    expect(prompt).toContain("52/100");
    expect(prompt).toContain('"Programmatic SEO automation"');
    expect(prompt).toContain("https://real.example.com/top");
    expect(prompt).toContain("[TOP STORY]");
    expect(prompt).toContain("[QUICK HIT]");
    expect(prompt).toContain('"scoreDelta": integer between -3 and 3');
  });
});

describe("briefing rescore schema", () => {
  const gapTitles = INPUT.report.gaps.map((gap) => gap.title);

  test("valid output parses with bounded delta and action minutes", () => {
    const parsed = parseBriefingRescore(JSON.stringify(VALID_OUTPUT), gapTitles);
    expect(parsed.scoreDelta).toBe(-1);
    expect(parsed.dailyAction.minutes).toBe(15);
    expect(parsed.dailyAction.gapRef).toBe("Programmatic SEO automation");
    expect(parsed.gapAdjustments).toHaveLength(1);
  });

  test("code fences are tolerated", () => {
    const parsed = parseBriefingRescore("```json\n" + JSON.stringify(VALID_OUTPUT) + "\n```", gapTitles);
    expect(parsed.dailyAction.minutes).toBe(15);
  });

  test("scoreDelta outside -3..3 is rejected", () => {
    const bad = { ...VALID_OUTPUT, scoreDelta: 5 };
    expect(() => parseBriefingRescore(JSON.stringify(bad), gapTitles)).toThrowError(
      /RESCORE_INVALID_OUTPUT:scoreDelta/,
    );
  });

  test("minutes outside 10..20 are rejected", () => {
    const bad = { ...VALID_OUTPUT, dailyAction: { ...VALID_OUTPUT.dailyAction, minutes: 45 } };
    expect(() => parseBriefingRescore(JSON.stringify(bad), gapTitles)).toThrowError(
      /RESCORE_INVALID_OUTPUT:dailyAction.minutes/,
    );
  });

  test("a gapRef that matches none of the report's gaps is a fabrication -> rejected", () => {
    const bad = {
      ...VALID_OUTPUT,
      dailyAction: { ...VALID_OUTPUT.dailyAction, gapRef: "Invented gap" },
    };
    expect(() => parseBriefingRescore(JSON.stringify(bad), gapTitles)).toThrowError(
      "RESCORE_INVALID_OUTPUT:dailyAction.gapRef",
    );
  });

  test("a gapAdjustment pointing at an invented gap is rejected", () => {
    const bad = {
      ...VALID_OUTPUT,
      gapAdjustments: [{ gapTitle: "Not a real gap", direction: "up", reason: "x" }],
    };
    expect(() => parseBriefingRescore(JSON.stringify(bad), gapTitles)).toThrowError(
      "RESCORE_INVALID_OUTPUT:gapAdjustments.gapTitle",
    );
  });

  test("nonzero delta without a reason is rejected", () => {
    const bad = { ...VALID_OUTPUT, scoreDeltaReason: "" };
    expect(() => parseBriefingRescore(JSON.stringify(bad), gapTitles)).toThrowError(
      "RESCORE_INVALID_OUTPUT:scoreDeltaReason",
    );
  });

  test("zero/omitted delta with empty reason is fine; artifactRef may be omitted", () => {
    const minimal = {
      gapAdjustments: [],
      dailyAction: {
        title: "Read the keyword clustering release notes and map one use",
        minutes: 10,
        gapRef: "AI copy evaluation",
      },
    };
    const parsed = parseBriefingRescore(JSON.stringify(minimal), gapTitles);
    expect(parsed.scoreDelta).toBe(0);
    expect(parsed.dailyAction.artifactRef).toBeNull();
  });

  test("non-JSON output fails loudly", () => {
    expect(() => parseBriefingRescore("I think you should...", gapTitles)).toThrowError(
      "RESCORE_INVALID_OUTPUT:NOT_JSON",
    );
  });
});

describe("briefing rescore failure contract (paid-tier: hard failure)", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  test("missing API key -> OPENAI_CONFIG_MISSING, never a fabricated action", async () => {
    await expect(generateBriefingRescore(INPUT)).rejects.toThrowError("OPENAI_CONFIG_MISSING");
  });

  test("upstream failure propagates loudly", async () => {
    await expect(
      generateBriefingRescore(INPUT, {
        callLlm: async () => {
          throw new Error("OPENAI_RESPONSE_FAILED:500:boom");
        },
      }),
    ).rejects.toThrowError("OPENAI_RESPONSE_FAILED:500:boom");
  });

  test("invalid model output propagates as RESCORE_INVALID_OUTPUT", async () => {
    await expect(
      generateBriefingRescore(INPUT, { callLlm: async () => "not json" }),
    ).rejects.toThrowError("RESCORE_INVALID_OUTPUT:NOT_JSON");
  });

  test("valid model output round-trips", async () => {
    const { rescore, model } = await generateBriefingRescore(INPUT, {
      callLlm: async () => JSON.stringify(VALID_OUTPUT),
    });
    expect(rescore.dailyAction.gapRef).toBe("Programmatic SEO automation");
    expect(model.length).toBeGreaterThan(0);
  });
});
