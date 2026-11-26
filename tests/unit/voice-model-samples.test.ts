import { describe, expect, test } from "vitest";
import { VOICE_MODEL_MAX_SAMPLES, VOICE_MODEL_SAMPLE_MAX_CHARS } from "@aitutor/shared";
import {
  VOICE_MODEL_SAMPLE_MIN_CHARS,
  prepareVoiceSampleBatch,
  splitVoiceSamples,
  voiceSamplePreview,
} from "../../apps/web/lib/voice-model/samples";
import { isValidVoiceModelSlug, slugifyVoiceModelName, uniqueVoiceModelSlug } from "../../apps/web/lib/voice-model/slug";

const long = (n: number) => "x".repeat(n);
const piece = (label: string) => `${label}: a launch email about the new season and what changes for players.`;

describe("splitVoiceSamples", () => {
  test("one sample without separators", () => {
    expect(splitVoiceSamples("  Hello there, this is one email.  ")).toEqual(["Hello there, this is one email."]);
  });

  test("splits on lines of three or more dashes, ignoring empty pieces", () => {
    const text = ["First one", "line two", "---", "", "Second", "  -----  ", "---", "Third", "---"].join("\r\n");
    expect(splitVoiceSamples(text)).toEqual(["First one\nline two", "Second", "Third"]);
  });

  test("dashes inside a line do not split", () => {
    expect(splitVoiceSamples("Season 4 --- drops Friday\nand -- more")).toHaveLength(1);
  });

  test("empty input gives nothing", () => {
    expect(splitVoiceSamples("\n---\n  \n")).toEqual([]);
  });
});

describe("prepareVoiceSampleBatch", () => {
  test("accepts a valid batch and keeps the title only for a single sample", () => {
    const single = prepareVoiceSampleBatch({ text: piece("one"), title: " Launch email ", existingCount: 0 });
    expect(single).toEqual({ ok: true, samples: [{ title: "Launch email", content: piece("one") }] });
    const many = prepareVoiceSampleBatch({ text: `${piece("one")}\n---\n${piece("two")}`, title: "ignored", existingCount: 0 });
    expect(many.ok && many.samples.map((entry) => entry.title)).toEqual([null, null]);
  });

  test("rejects empty pastes", () => {
    expect(prepareVoiceSampleBatch({ text: " --- ", existingCount: 0 })).toMatchObject({ ok: false, code: "VOICE_MODEL_SAMPLES_EMPTY" });
  });

  test("rejects short samples and says which one", () => {
    const result = prepareVoiceSampleBatch({ text: `${piece("one")}\n---\ntoo short`, existingCount: 0 });
    expect(result).toMatchObject({ ok: false, code: "VOICE_MODEL_SAMPLE_TOO_SHORT", sampleNumber: 2 });
    expect(!result.ok && result.message).toContain(`${VOICE_MODEL_SAMPLE_MIN_CHARS} characters`);
  });

  test("rejects samples over the per-sample limit", () => {
    const result = prepareVoiceSampleBatch({ text: long(VOICE_MODEL_SAMPLE_MAX_CHARS + 1), existingCount: 0 });
    expect(result).toMatchObject({ ok: false, code: "VOICE_MODEL_SAMPLE_TOO_LONG", sampleNumber: 1 });
    expect(prepareVoiceSampleBatch({ text: long(VOICE_MODEL_SAMPLE_MAX_CHARS), existingCount: 0 }).ok).toBe(true);
  });

  test("respects the sample cap with the existing count", () => {
    const two = `${piece("one")}\n---\n${piece("two")}`;
    const full = prepareVoiceSampleBatch({ text: two, existingCount: VOICE_MODEL_MAX_SAMPLES });
    expect(full).toMatchObject({ ok: false, code: "VOICE_MODEL_SAMPLE_LIMIT" });
    expect(!full.ok && full.message).toContain("maximum");
    const almost = prepareVoiceSampleBatch({ text: two, existingCount: VOICE_MODEL_MAX_SAMPLES - 1 });
    expect(!almost.ok && almost.message).toContain("You can add 1 more sample");
    expect(prepareVoiceSampleBatch({ text: two, existingCount: VOICE_MODEL_MAX_SAMPLES - 2 }).ok).toBe(true);
  });

  test("preview uses the first non-empty line", () => {
    expect(voiceSamplePreview("\n\nSubject: Season 4\nBody")).toBe("Subject: Season 4");
    expect(voiceSamplePreview(long(200), 10)).toHaveLength(10);
  });
});

describe("voice model slugs", () => {
  test("slugify", () => {
    expect(slugifyVoiceModelName("Maya Voice v1")).toBe("maya-voice-v1");
    expect(slugifyVoiceModelName("  Café — Notes!! ")).toBe("cafe-notes");
    expect(slugifyVoiceModelName("!!!")).toBe("voice-model");
    expect(slugifyVoiceModelName(long(80)).length).toBeLessThanOrEqual(48);
  });

  test("unique suffixes", () => {
    expect(uniqueVoiceModelSlug("a", [])).toBe("a");
    expect(uniqueVoiceModelSlug("a", ["a", "a-2"])).toBe("a-3");
    const longBase = "x".repeat(48);
    const next = uniqueVoiceModelSlug(longBase, [longBase]);
    expect(next.endsWith("-2")).toBe(true);
    expect(next.length).toBeLessThanOrEqual(48);
  });

  test("validation", () => {
    expect(isValidVoiceModelSlug("maya-voice-v1")).toBe(true);
    expect(isValidVoiceModelSlug("Maya")).toBe(false);
    expect(isValidVoiceModelSlug("a--b")).toBe(false);
    expect(isValidVoiceModelSlug("../x")).toBe(false);
  });
});
