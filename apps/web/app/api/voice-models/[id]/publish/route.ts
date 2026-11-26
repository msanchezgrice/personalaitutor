import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { readJsonBody, resolveOwnedVoiceModel, voiceModelPublicPath } from "@/lib/voice-model/access";
import { publishBodySchema } from "@/lib/voice-model/schemas";
import { setVoiceModelPublished } from "@/lib/voice-model/store";

type Context = { params: Promise<{ id: string }> };

/** Body `{ published }`. Only a tuned model can be published. */
export async function POST(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const access = await resolveOwnedVoiceModel(req, id);
    if (!access.ok) return access.response;
    const parsed = publishBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Say whether to publish the model.", 400, { issues: parsed.error.issues });
    }
    if (parsed.data.published && (access.model.status !== "ready" || !access.model.styleProfile)) {
      return jsonError("VOICE_MODEL_NOT_TUNED", "Tune the model before publishing it.", 409);
    }
    const model = await setVoiceModelPublished(access.model.id, parsed.data.published);
    return jsonOk({
      model,
      publicPath: voiceModelPublicPath(access.owner.handle, model.slug),
      profilePublished: access.owner.profilePublished,
    });
  } catch (error) {
    return jsonError("VOICE_MODEL_FAILED", "Could not change the publish state", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
    });
  }
}
