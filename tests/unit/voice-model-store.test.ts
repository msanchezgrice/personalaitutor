import { beforeEach, describe, expect, test } from "vitest";
import { VOICE_MODEL_METHOD_LABEL, VOICE_MODEL_MIN_SAMPLES, type VoiceStyleProfile } from "@aitutor/shared";
import {
  addVoiceModelSamples,
  createVoiceModel,
  deleteVoiceModel,
  deleteVoiceModelSample,
  findVoiceModelBySlug,
  getVoiceModelForOwner,
  getVoiceModelStatus,
  listPublishedVoiceModels,
  listRecentVoiceModelRunTimes,
  listVoiceModelSamples,
  listVoiceModelsForProfile,
  recordVoiceModelRun,
  resetVoiceModelStateForTests,
  saveVoiceModelTuning,
  setVoiceModelDemo,
  setVoiceModelPublished,
  updateVoiceModelDetails,
} from "../../apps/web/lib/voice-model/store";

const PROFILE: VoiceStyleProfile = {
  summary: "Short, warm sentences that get to the point and end with a clear ask.",
  tone: ["warm", "direct"],
  habits: ["Opens with the news", "Uses second person", "Ends with one call to action"],
  avoid: ["hype words", "exclamation marks"],
  signaturePhrases: ["squad up"],
};

const sample = (n: number) => ({ title: null, content: `Sample number ${n}: the season starts soon and here is what changes for you.` });

async function makeModel(learnerProfileId = "learner-1", name = "Maya Voice v1") {
  return createVoiceModel({ learnerProfileId, name, purpose: "game launch announcements", sampleType: "launch emails" });
}

async function makeTunedModel(learnerProfileId = "learner-1") {
  const model = await makeModel(learnerProfileId);
  await addVoiceModelSamples({
    voiceModelId: model.id,
    learnerProfileId,
    samples: Array.from({ length: VOICE_MODEL_MIN_SAMPLES }, (_, index) => sample(index + 1)),
  });
  return saveVoiceModelTuning(model.id, {
    styleProfile: PROFILE,
    baseModel: "gpt-4.1-mini",
    demo: { demoPrompt: "Announce Season 4", demoBaseOutput: "Base text.", demoTunedOutput: "Tuned text." },
  });
}

describe("voice model store (memory mode)", () => {
  beforeEach(() => resetVoiceModelStateForTests());

  test("creates a draft model with a slug derived from the name", async () => {
    const model = await makeModel();
    expect(model).toMatchObject({
      slug: "maya-voice-v1",
      name: "Maya Voice v1",
      status: "draft",
      published: false,
      sampleCount: 0,
      styleProfile: null,
      tunedAt: null,
    });
  });

  test("slugs are unique per learner, not globally", async () => {
    const first = await makeModel("learner-1");
    const second = await makeModel("learner-1");
    const third = await makeModel("learner-1");
    const otherLearner = await makeModel("learner-2");
    expect([first.slug, second.slug, third.slug]).toEqual(["maya-voice-v1", "maya-voice-v1-2", "maya-voice-v1-3"]);
    expect(otherLearner.slug).toBe("maya-voice-v1");
  });

  test("renaming keeps the slug", async () => {
    const model = await makeModel();
    const renamed = await updateVoiceModelDetails(model.id, { name: "Something else" });
    expect(renamed.name).toBe("Something else");
    expect(renamed.slug).toBe("maya-voice-v1");
  });

  test("owner lookup hides other learners' models", async () => {
    const model = await makeModel("learner-1");
    expect(await getVoiceModelForOwner({ id: model.id, learnerProfileId: "learner-1" })).not.toBeNull();
    expect(await getVoiceModelForOwner({ id: model.id, learnerProfileId: "learner-2" })).toBeNull();
    expect(await getVoiceModelForOwner({ id: "missing", learnerProfileId: "learner-1" })).toBeNull();
  });

  test("samples keep paste order and sampleCount tracks them", async () => {
    const model = await makeModel();
    await addVoiceModelSamples({ voiceModelId: model.id, learnerProfileId: "learner-1", samples: [sample(1), sample(2)] });
    const { model: after } = await addVoiceModelSamples({ voiceModelId: model.id, learnerProfileId: "learner-1", samples: [sample(3)] });
    expect(after.sampleCount).toBe(3);
    const stored = await listVoiceModelSamples(model.id);
    expect(stored.map((entry) => entry.content.slice(0, 15))).toEqual(["Sample number 1", "Sample number 2", "Sample number 3"]);
  });

  test("samples added right before a tune are never newer than the tune", async () => {
    const tuned = await makeTunedModel();
    const samples = await listVoiceModelSamples(tuned.id);
    expect(samples.filter((entry) => entry.createdAt > tuned.tunedAt!)).toEqual([]);
  });

  test("refuses a batch that passes the sample cap", async () => {
    const model = await makeModel();
    await addVoiceModelSamples({
      voiceModelId: model.id,
      learnerProfileId: "learner-1",
      samples: Array.from({ length: 39 }, (_, index) => sample(index)),
    });
    await expect(
      addVoiceModelSamples({ voiceModelId: model.id, learnerProfileId: "learner-1", samples: [sample(40), sample(41)] }),
    ).rejects.toThrow("VOICE_MODEL_SAMPLE_LIMIT");
    expect((await listVoiceModelSamples(model.id)).length).toBe(39);
  });

  test("deleting a sample only works on its own model", async () => {
    const a = await makeModel();
    const b = await makeModel();
    const { samples } = await addVoiceModelSamples({ voiceModelId: a.id, learnerProfileId: "learner-1", samples: [sample(1)] });
    expect(await deleteVoiceModelSample({ voiceModelId: b.id, sampleId: samples[0]!.id })).toBeNull();
    const after = await deleteVoiceModelSample({ voiceModelId: a.id, sampleId: samples[0]!.id });
    expect(after?.sampleCount).toBe(0);
  });

  test("a tuned model that drops below the minimum goes back to draft and is unpublished", async () => {
    const tuned = await makeTunedModel();
    await setVoiceModelPublished(tuned.id, true);
    const samples = await listVoiceModelSamples(tuned.id);
    const after = await deleteVoiceModelSample({ voiceModelId: tuned.id, sampleId: samples[0]!.id });
    expect(after).toMatchObject({ status: "draft", published: false, sampleCount: VOICE_MODEL_MIN_SAMPLES - 1 });
  });

  test("only tuned models can be published", async () => {
    const model = await makeModel();
    await expect(setVoiceModelPublished(model.id, true)).rejects.toThrow("VOICE_MODEL_NOT_TUNED");
    const tuned = await makeTunedModel();
    expect((await setVoiceModelPublished(tuned.id, true)).published).toBe(true);
  });

  test("deleting a model deletes its samples and runs", async () => {
    const tuned = await makeTunedModel();
    await recordVoiceModelRun({ voiceModelId: tuned.id, source: "public", ipHash: "hash", prompt: "hi there" });
    await deleteVoiceModel(tuned.id);
    expect(await listVoiceModelsForProfile("learner-1")).toEqual([]);
    expect(await listVoiceModelSamples(tuned.id)).toEqual([]);
    expect(await listRecentVoiceModelRunTimes({ voiceModelId: tuned.id, sinceIso: "2000-01-01T00:00:00Z", limit: 10 })).toEqual([]);
  });

  test("public list has only published tuned models, without samples", async () => {
    await makeModel();
    const tuned = await makeTunedModel();
    expect(await listPublishedVoiceModels("learner-1")).toEqual([]);
    await setVoiceModelPublished(tuned.id, true);
    const published = await listPublishedVoiceModels("learner-1");
    expect(published).toHaveLength(1);
    expect(published[0]).toEqual({
      slug: tuned.slug,
      name: "Maya Voice v1",
      purpose: "game launch announcements",
      sampleType: "launch emails",
      baseModel: "gpt-4.1-mini",
      sampleCount: VOICE_MODEL_MIN_SAMPLES,
      demoPrompt: "Announce Season 4",
      demoBaseOutput: "Base text.",
      demoTunedOutput: "Tuned text.",
      tunedAt: expect.any(String),
      methodLabel: VOICE_MODEL_METHOD_LABEL,
    });
    expect(JSON.stringify(published)).not.toContain("Sample number");
  });

  test("setVoiceModelDemo replaces the saved comparison", async () => {
    const tuned = await makeTunedModel();
    const after = await setVoiceModelDemo(tuned.id, { demoPrompt: "New task", demoBaseOutput: "B", demoTunedOutput: "T" });
    expect(after).toMatchObject({ demoPrompt: "New task", demoBaseOutput: "B", demoTunedOutput: "T" });
  });

  test("findVoiceModelBySlug is scoped to the learner", async () => {
    const model = await makeModel("learner-1");
    expect((await findVoiceModelBySlug({ learnerProfileId: "learner-1", slug: model.slug }))?.id).toBe(model.id);
    expect(await findVoiceModelBySlug({ learnerProfileId: "learner-2", slug: model.slug })).toBeNull();
  });

  test("status: empty, draft with samples needed, draft tuned, live", async () => {
    expect((await getVoiceModelStatus("learner-1")).state).toBe("empty");

    const model = await makeModel();
    await addVoiceModelSamples({ voiceModelId: model.id, learnerProfileId: "learner-1", samples: [sample(1), sample(2)] });
    expect(await getVoiceModelStatus("learner-1")).toEqual({
      state: "draft",
      summary: `Add ${VOICE_MODEL_MIN_SAMPLES - 2} more samples to tune Maya Voice v1.`,
    });

    await addVoiceModelSamples({
      voiceModelId: model.id,
      learnerProfileId: "learner-1",
      samples: Array.from({ length: VOICE_MODEL_MIN_SAMPLES - 3 }, (_, index) => sample(index + 3)),
    });
    expect((await getVoiceModelStatus("learner-1")).summary).toBe("Add 1 more sample to tune Maya Voice v1.");

    await addVoiceModelSamples({ voiceModelId: model.id, learnerProfileId: "learner-1", samples: [sample(9)] });
    expect((await getVoiceModelStatus("learner-1")).summary).toContain("Tune it");

    await saveVoiceModelTuning(model.id, { styleProfile: PROFILE, baseModel: "gpt-4.1-mini", demo: null });
    expect((await getVoiceModelStatus("learner-1")).summary).toContain("Publish it");

    await setVoiceModelPublished(model.id, true);
    expect(await getVoiceModelStatus("learner-1")).toEqual({
      state: "live",
      summary: `Maya Voice v1 is live, tuned on ${VOICE_MODEL_MIN_SAMPLES} launch emails.`,
    });
  });

  test("run times filter by model, ip hash, source and window", async () => {
    const tuned = await makeTunedModel();
    await recordVoiceModelRun({ voiceModelId: tuned.id, source: "public", ipHash: "a", prompt: "one" });
    await recordVoiceModelRun({ voiceModelId: tuned.id, source: "public", ipHash: "b", prompt: "two" });
    await recordVoiceModelRun({ voiceModelId: tuned.id, source: "owner", ipHash: null, prompt: "three" });
    const since = new Date(Date.now() - 60_000).toISOString();
    expect(await listRecentVoiceModelRunTimes({ ipHash: "a", source: "public", sinceIso: since, limit: 10 })).toHaveLength(1);
    expect(await listRecentVoiceModelRunTimes({ voiceModelId: tuned.id, source: "public", sinceIso: since, limit: 10 })).toHaveLength(2);
    expect(await listRecentVoiceModelRunTimes({ voiceModelId: tuned.id, sinceIso: since, limit: 2 })).toHaveLength(2);
    expect(await listRecentVoiceModelRunTimes({ voiceModelId: tuned.id, sinceIso: new Date(Date.now() + 60_000).toISOString(), limit: 10 })).toHaveLength(0);
  });
});
