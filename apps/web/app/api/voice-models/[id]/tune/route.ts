import type { NextRequest } from "next/server";
import { VOICE_MODEL_MIN_SAMPLES, jsonError, jsonOk } from "@aitutor/shared";
import { resolveOwnedVoiceModel } from "@/lib/voice-model/access";
import { runVoiceComparison, voiceModelFailureCode } from "@/lib/voice-model/run";
import { listVoiceModelSamples, recordVoiceModelRun, saveVoiceModelTuning } from "@/lib/voice-model/store";
import { tuneVoiceModel } from "@/lib/voice-model/tune";

export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

/**
 * Tunes the model in context: derives the voice profile from the samples, then
 * runs a first comparison (the saved demo prompt, or a task the tuning call
 * proposes) and saves it as the public demo. If only the demo run fails, the
 * profile is still saved and the existing demo, if any, is kept.
 */
export async function POST(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const access = await resolveOwnedVoiceModel(req, id);
    if (!access.ok) return access.response;
    const model = access.model;
    const samples = await listVoiceModelSamples(model.id);
    if (samples.length < VOICE_MODEL_MIN_SAMPLES) {
      const needed = VOICE_MODEL_MIN_SAMPLES - samples.length;
      return jsonError(
        "VOICE_MODEL_NOT_ENOUGH_SAMPLES",
        `Add ${needed} more ${needed === 1 ? "sample" : "samples"} before tuning. A model needs at least ${VOICE_MODEL_MIN_SAMPLES}.`,
        409,
        { needed },
      );
    }

    let tuned;
    try {
      tuned = await tuneVoiceModel({
        name: model.name,
        purpose: model.purpose,
        sampleType: model.sampleType,
        samples,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN";
      return jsonError(voiceModelFailureCode(error), "Tuning did not finish. Nothing was changed.", 502, {
        reason: reason.slice(0, 300),
        recoveryAction: "Try tuning again in a minute.",
      });
    }

    const demoPrompt = model.demoPrompt ?? tuned.demoTask;
    let demo: { demoPrompt: string; demoBaseOutput: string; demoTunedOutput: string } | null = null;
    let demoMessage: string | null = null;
    try {
      await recordVoiceModelRun({ voiceModelId: model.id, source: "owner", ipHash: null, prompt: demoPrompt });
      const comparison = await runVoiceComparison({
        model: { ...model, styleProfile: tuned.profile, baseModel: tuned.model },
        samples,
        prompt: demoPrompt,
      });
      if (comparison.refused) {
        demoMessage = "The first comparison was refused as off-topic. Test a task below and save it as your demo.";
      } else {
        demo = {
          demoPrompt: comparison.result.prompt,
          demoBaseOutput: comparison.result.baseOutput,
          demoTunedOutput: comparison.result.tunedOutput,
        };
      }
    } catch {
      demoMessage = "The voice profile is saved, but the first comparison did not run. Test a task below and save it as your demo.";
    }

    const saved = await saveVoiceModelTuning(model.id, {
      styleProfile: tuned.profile,
      baseModel: tuned.model,
      demo,
    });
    return jsonOk({ model: saved, samplesRead: tuned.samplesRead, demoSaved: demo !== null, demoMessage });
  } catch (error) {
    return jsonError("VOICE_MODEL_FAILED", "Tuning did not finish", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
    });
  }
}
