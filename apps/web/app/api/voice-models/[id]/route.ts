import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { readJsonBody, resolveOwnedVoiceModel } from "@/lib/voice-model/access";
import { verifyVoiceModelRunSignature } from "@/lib/voice-model/rate-limit";
import { patchVoiceModelBodySchema } from "@/lib/voice-model/schemas";
import {
  deleteVoiceModel,
  listVoiceModelSamples,
  setVoiceModelDemo,
  updateVoiceModelDetails,
} from "@/lib/voice-model/store";

type Context = { params: Promise<{ id: string }> };

function failure(message: string, error: unknown) {
  return jsonError("VOICE_MODEL_FAILED", message, 500, {
    reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
  });
}

export async function GET(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const access = await resolveOwnedVoiceModel(req, id);
    if (!access.ok) return access.response;
    const samples = await listVoiceModelSamples(access.model.id);
    return jsonOk({ model: access.model, samples });
  } catch (error) {
    return failure("Could not load the model", error);
  }
}

/**
 * Edit name, purpose or sample type, or save a comparison as the public demo.
 * A demo must carry the signature its run returned: only output the model
 * really produced can be shown as the model's output.
 */
export async function PATCH(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const access = await resolveOwnedVoiceModel(req, id);
    if (!access.ok) return access.response;
    const parsed = patchVoiceModelBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Nothing valid to update.", 400, { issues: parsed.error.issues });
    }
    const { demo, ...details } = parsed.data;
    let model = access.model;
    if (demo) {
      const result = { prompt: demo.prompt, baseOutput: demo.baseOutput, tunedOutput: demo.tunedOutput };
      if (!verifyVoiceModelRunSignature(model.id, result, demo.signature)) {
        return jsonError(
          "VOICE_MODEL_DEMO_UNVERIFIED",
          "The demo must be a comparison the model really ran. Run it again, then save it.",
          400,
        );
      }
      model = await setVoiceModelDemo(model.id, {
        demoPrompt: result.prompt,
        demoBaseOutput: result.baseOutput,
        demoTunedOutput: result.tunedOutput,
      });
    }
    if (details.name !== undefined || details.purpose !== undefined || details.sampleType !== undefined) {
      model = await updateVoiceModelDetails(model.id, details);
    }
    return jsonOk({ model });
  } catch (error) {
    return failure("Could not update the model", error);
  }
}

/** Deletes the model and all of its samples. */
export async function DELETE(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const access = await resolveOwnedVoiceModel(req, id);
    if (!access.ok) return access.response;
    await deleteVoiceModel(access.model.id);
    return jsonOk({ deleted: true });
  } catch (error) {
    return failure("Could not delete the model", error);
  }
}
