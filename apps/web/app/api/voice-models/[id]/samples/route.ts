import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { readJsonBody, resolveOwnedVoiceModel } from "@/lib/voice-model/access";
import { prepareVoiceSampleBatch } from "@/lib/voice-model/samples";
import { addSamplesBodySchema } from "@/lib/voice-model/schemas";
import { addVoiceModelSamples } from "@/lib/voice-model/store";

type Context = { params: Promise<{ id: string }> };

/** Adds one sample, or many separated by a line of `---`. All or nothing. */
export async function POST(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const access = await resolveOwnedVoiceModel(req, id);
    if (!access.ok) return access.response;
    const parsed = addSamplesBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Paste the writing you want to add.", 400, { issues: parsed.error.issues });
    }
    const batch = prepareVoiceSampleBatch({
      text: parsed.data.text,
      title: parsed.data.title ?? null,
      existingCount: access.model.sampleCount,
    });
    if (!batch.ok) {
      return jsonError(batch.code, batch.message, batch.code === "VOICE_MODEL_SAMPLE_LIMIT" ? 409 : 400, {
        ...(batch.sampleNumber ? { sampleNumber: batch.sampleNumber } : {}),
      });
    }
    try {
      const { model, samples } = await addVoiceModelSamples({
        voiceModelId: access.model.id,
        learnerProfileId: access.owner.learnerProfileId,
        samples: batch.samples,
      });
      return jsonOk({ model, samples });
    } catch (error) {
      if (error instanceof Error && error.message === "VOICE_MODEL_SAMPLE_LIMIT") {
        return jsonError("VOICE_MODEL_SAMPLE_LIMIT", "This paste would take the model past its sample limit.", 409);
      }
      throw error;
    }
  } catch (error) {
    return jsonError("VOICE_MODEL_FAILED", "Could not save the samples", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
    });
  }
}
