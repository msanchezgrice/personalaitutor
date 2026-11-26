import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { readJsonBody, resolveOwnedVoiceModel } from "@/lib/voice-model/access";
import { signVoiceModelRun } from "@/lib/voice-model/rate-limit";
import { runVoiceComparison, voiceModelFailureCode } from "@/lib/voice-model/run";
import { runBodySchema } from "@/lib/voice-model/schemas";
import { listVoiceModelSamples, recordVoiceModelRun } from "@/lib/voice-model/store";

export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

/**
 * Owner test run: base vs tuned on the owner's own task. A successful run
 * returns a signature so the owner can save exactly this comparison as the
 * public demo (PATCH /api/voice-models/[id] with `demo`).
 */
export async function POST(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const access = await resolveOwnedVoiceModel(req, id);
    if (!access.ok) return access.response;
    const parsed = runBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Write a task of up to 400 characters.", 400, { issues: parsed.error.issues });
    }
    const model = access.model;
    if (model.status !== "ready" || !model.styleProfile) {
      return jsonError("VOICE_MODEL_NOT_TUNED", "Tune the model before testing it.", 409);
    }
    await recordVoiceModelRun({ voiceModelId: model.id, source: "owner", ipHash: null, prompt: parsed.data.prompt });
    const samples = await listVoiceModelSamples(model.id);
    try {
      const comparison = await runVoiceComparison({ model, samples, prompt: parsed.data.prompt });
      return jsonOk({
        result: comparison.result,
        refused: comparison.refused,
        samplesInContext: comparison.samplesInContext,
        signature: comparison.refused ? null : signVoiceModelRun(model.id, comparison.result),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN";
      return jsonError(voiceModelFailureCode(error), "The comparison did not run.", 502, {
        reason: reason.slice(0, 300),
        recoveryAction: "Try again in a minute.",
      });
    }
  } catch (error) {
    return jsonError("VOICE_MODEL_FAILED", "The comparison did not run", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
    });
  }
}
