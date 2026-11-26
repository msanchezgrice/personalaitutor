import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { readJsonBody, resolveVoiceModelOwner } from "@/lib/voice-model/access";
import { loadVoiceModelPrefill } from "@/lib/voice-model/prefill";
import { createVoiceModelBodySchema } from "@/lib/voice-model/schemas";
import { VOICE_MODEL_MAX_PER_LEARNER, createVoiceModel, listVoiceModelsForProfile } from "@/lib/voice-model/store";

/** The learner's voice models, plus a name/sample-type suggestion from their career map. */
export async function GET(req: NextRequest) {
  try {
    const access = await resolveVoiceModelOwner(req);
    if (!access.ok) return access.response;
    const [models, prefill] = await Promise.all([
      listVoiceModelsForProfile(access.owner.learnerProfileId),
      loadVoiceModelPrefill(access.owner.learnerProfileId),
    ]);
    return jsonOk({ models, prefill });
  } catch (error) {
    return jsonError("VOICE_MODEL_FAILED", "Could not load your models", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await resolveVoiceModelOwner(req);
    if (!access.ok) return access.response;
    const parsed = createVoiceModelBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Give the model a name, what it writes and what the samples are.", 400, {
        issues: parsed.error.issues,
      });
    }
    let model;
    try {
      model = await createVoiceModel({ learnerProfileId: access.owner.learnerProfileId, ...parsed.data });
    } catch (error) {
      // Lost a race for the same slug: the next attempt sees it and picks another.
      if (error instanceof Error && error.message === "VOICE_MODEL_SLUG_TAKEN") {
        model = await createVoiceModel({ learnerProfileId: access.owner.learnerProfileId, ...parsed.data });
      } else {
        throw error;
      }
    }
    return jsonOk({ model });
  } catch (error) {
    if (error instanceof Error && error.message === "VOICE_MODEL_LIMIT_REACHED") {
      return jsonError(
        "VOICE_MODEL_LIMIT_REACHED",
        `You can have up to ${VOICE_MODEL_MAX_PER_LEARNER} voice models. Delete one you no longer use to make a new one.`,
        409,
        { limit: VOICE_MODEL_MAX_PER_LEARNER },
      );
    }
    return jsonError("VOICE_MODEL_FAILED", "Could not create the model", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
    });
  }
}
