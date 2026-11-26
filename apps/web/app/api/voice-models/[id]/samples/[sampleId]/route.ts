import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { resolveOwnedVoiceModel } from "@/lib/voice-model/access";
import { deleteVoiceModelSample } from "@/lib/voice-model/store";

type Context = { params: Promise<{ id: string; sampleId: string }> };

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const { id, sampleId } = await context.params;
    const access = await resolveOwnedVoiceModel(req, id);
    if (!access.ok) return access.response;
    const model = await deleteVoiceModelSample({ voiceModelId: access.model.id, sampleId });
    if (!model) return jsonError("VOICE_MODEL_SAMPLE_NOT_FOUND", "That sample was not found.", 404);
    return jsonOk({ model });
  } catch (error) {
    return jsonError("VOICE_MODEL_FAILED", "Could not remove the sample", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
    });
  }
}
