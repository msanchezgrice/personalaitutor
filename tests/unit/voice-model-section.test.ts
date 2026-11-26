import { beforeEach, describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { VOICE_MODEL_METHOD_LABEL, VOICE_MODEL_MIN_SAMPLES } from "@aitutor/shared";

vi.mock("@/lib/analytics", () => ({ captureAnalyticsEvent: vi.fn() }));

import { ProfileVoiceModelSection } from "../../apps/web/components/proof/profile-voice-model-section";
import { VoiceModelStudio } from "../../apps/web/components/proof/voice-model-studio";
import {
  addVoiceModelSamples,
  createVoiceModel,
  listVoiceModelSamples,
  resetVoiceModelStateForTests,
  saveVoiceModelTuning,
  setVoiceModelPublished,
} from "../../apps/web/lib/voice-model/store";
import { voiceModelRunErrorMessage } from "../../apps/web/lib/voice-model/format";

const PROFILE = {
  summary: "Short, punchy lines that talk straight to players.",
  tone: ["playful", "direct"],
  habits: ["Opens with a two-word hook", "Uses second person", "One idea per line"],
  avoid: ["corporate hype", "long intros"],
  signaturePhrases: [],
};

async function seedModel(publish: boolean) {
  const model = await createVoiceModel({ learnerProfileId: "learner-a", name: "maya-voice-v1", purpose: "game announcements", sampleType: "launch emails" });
  await addVoiceModelSamples({
    voiceModelId: model.id,
    learnerProfileId: "learner-a",
    samples: Array.from({ length: VOICE_MODEL_MIN_SAMPLES }, (_, index) => ({ title: null, content: `Private sample text number ${index} that visitors must never see.` })),
  });
  const tuned = await saveVoiceModelTuning(model.id, {
    styleProfile: PROFILE,
    baseModel: "gpt-4.1-mini",
    demo: {
      demoPrompt: "Announce that Season 4 starts Friday",
      demoBaseOutput: "Exciting update coming soon! Season 4 arrives this Friday with new content.",
      demoTunedOutput: "Squad up. Season 4 drops Friday.",
    },
  });
  if (publish) await setVoiceModelPublished(model.id, true);
  return tuned;
}

async function renderSection() {
  const element = await ProfileVoiceModelSection({ learnerProfileId: "learner-a", handle: "maya", displayName: "Maya Ortiz" });
  return element ? renderToStaticMarkup(element) : null;
}

describe("ProfileVoiceModelSection", () => {
  beforeEach(() => resetVoiceModelStateForTests());

  test("renders nothing without a published model", async () => {
    expect(await renderSection()).toBeNull();
    await seedModel(false);
    expect(await renderSection()).toBeNull();
  });

  test("renders the saved demo, the task input and the model card", async () => {
    const model = await seedModel(true);
    const html = (await renderSection())!;
    expect(html).toContain("Try my model");
    expect(html).toContain("maya-voice-v1 writes game announcements the way I do.");
    expect(html).toContain("What should it write?");
    expect(html).toContain('value="Announce that Season 4 starts Friday"');
    expect(html).toContain('maxLength="400"');
    expect(html).toContain("Run both");
    expect(html).toContain("Exciting update coming soon! Season 4 arrives this Friday with new content.");
    expect(html).toContain("Squad up. Season 4 drops Friday.");
    expect(html).toContain("A saved run of the task above.");
    expect(html).toContain("gpt-4.1-mini");
    expect(html).toContain(VOICE_MODEL_METHOD_LABEL);
    expect(html).toContain(`${VOICE_MODEL_MIN_SAMPLES} launch emails`);
    expect(html).toContain("Not fine-tuned");
    expect(html).toContain(`id="model-${model.slug}"`);
    expect(html).not.toContain("Private sample text");
  });

  test("a store failure hides the section instead of breaking the page", async () => {
    vi.stubEnv("PERSISTENCE_MODE", "bogus");
    expect(await renderSection()).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe("VoiceModelStudio", () => {
  beforeEach(() => resetVoiceModelStateForTests());

  test("empty state asks for a name, prefilled from the career map", () => {
    const html = renderToStaticMarkup(
      createElement(VoiceModelStudio, {
        initialModels: [],
        initialSamples: {},
        prefill: { name: "maya-voice", sampleType: "launch emails", summary: "Paste 10 or more emails you wrote." },
        handle: "maya",
        profilePublished: true,
      }),
    );
    expect(html).toContain("Name your model");
    expect(html).toContain('value="maya-voice"');
    expect(html).toContain('value="launch emails"');
    expect(html).toContain("Suggested by your career map");
    expect(html).toContain("tuned in context, not fine-tuned");
  });

  test("a tuned model shows samples, profile, test and publish steps", async () => {
    const model = await seedModel(false);
    const samples = await listVoiceModelSamples(model.id);
    const html = renderToStaticMarkup(
      createElement(VoiceModelStudio, {
        initialModels: [model],
        initialSamples: { [model.id]: samples },
        prefill: null,
        handle: "maya",
        profilePublished: false,
      }),
    );
    expect(html).toContain(`${VOICE_MODEL_MIN_SAMPLES} of 40 samples · at least ${VOICE_MODEL_MIN_SAMPLES} to tune`);
    expect(html).toContain("Tune again");
    expect(html).toContain(PROFILE.summary);
    expect(html).toContain("Test it and pick your demo");
    expect(html).toContain("What visitors see first");
    expect(html).toContain("Publish model");
    expect(html).toContain("Tuned");
  });

  test("a draft model says how many samples are still needed", async () => {
    const model = await createVoiceModel({ learnerProfileId: "learner-a", name: "draft", purpose: "emails", sampleType: "emails" });
    const html = renderToStaticMarkup(
      createElement(VoiceModelStudio, { initialModels: [model], initialSamples: { [model.id]: [] }, prefill: null, handle: "maya", profilePublished: true }),
    );
    expect(html).toContain(`Add ${VOICE_MODEL_MIN_SAMPLES} more samples first.`);
    expect(html).toContain("Tune the model first.");
    expect(html).not.toContain("Test it and pick your demo");
  });
});

describe("run error sentences", () => {
  test("map codes to human sentences", () => {
    expect(voiceModelRunErrorMessage({ status: 429, code: "VOICE_MODEL_RATE_LIMITED", message: "Try again in about 5 minutes." })).toBe("Try again in about 5 minutes.");
    expect(voiceModelRunErrorMessage({ status: 404, code: "VOICE_MODEL_NOT_FOUND" })).toBe("This model is not available right now.");
    expect(voiceModelRunErrorMessage({ status: 502, code: "VOICE_MODEL_FAILED" })).toBe("The model did not answer this time. Try again in a minute.");
    expect(voiceModelRunErrorMessage({ status: 400, code: "INVALID_BODY" })).toContain("400 characters");
  });
});
