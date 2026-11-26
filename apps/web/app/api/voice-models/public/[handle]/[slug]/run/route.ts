import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { readJsonBody } from "@/lib/voice-model/access";
import { findPublicVoiceModel, voiceModelOwnerHasBillingAccess } from "@/lib/voice-model/public";
import { checkVoiceModelPublicRateLimit, hashVoiceModelRequestIp } from "@/lib/voice-model/rate-limit";
import { runVoiceComparison, voiceModelFailureCode } from "@/lib/voice-model/run";
import { runBodySchema } from "@/lib/voice-model/schemas";
import {
  deleteVoiceModelRun,
  listVoiceModelSamples,
  listVoiceModelsForProfile,
  recordVoiceModelRun,
} from "@/lib/voice-model/store";

export const maxDuration = 120;

type Context = { params: Promise<{ handle: string; slug: string }> };

async function forgetRun(id: string) {
  try {
    await deleteVoiceModelRun(id);
  } catch (error) {
    // The row only over-counts toward the limit; never fail the response for it.
    console.error("[voice-model] could not delete run row", error instanceof Error ? error.message : error);
  }
}

/**
 * Public "Try my model": a visitor's task through the base model and the
 * tuned model. Only for published models on published profiles whose owner
 * still has Career Builder access. Limited per hashed IP, per model and per
 * owner.
 *
 * Check-then-insert race: the run row is recorded first and the limits are
 * counted with it included, so concurrent requests cannot all slip under a
 * limit. A rejected run's row is deleted again, and so is the row of a run
 * whose model call failed. voice_model_runs has no output columns, so there
 * is nothing to fill in after a successful run, and run rows are never
 * rendered publicly.
 */
export async function POST(req: NextRequest, context: Context) {
  try {
    const { handle, slug } = await context.params;
    const parsed = runBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Write a task of up to 400 characters.", 400);
    }
    const model = await findPublicVoiceModel({ handle: decodeURIComponent(handle), slug: decodeURIComponent(slug) });
    if (!model || !(await voiceModelOwnerHasBillingAccess(model.learnerProfileId))) {
      return jsonError("VOICE_MODEL_NOT_FOUND", "This model is not available.", 404);
    }

    const ipHash = hashVoiceModelRequestIp(req);
    const run = await recordVoiceModelRun({ voiceModelId: model.id, source: "public", ipHash, prompt: parsed.data.prompt });
    let limit;
    try {
      const ownerModels = await listVoiceModelsForProfile(model.learnerProfileId);
      limit = await checkVoiceModelPublicRateLimit({
        voiceModelId: model.id,
        ipHash,
        ownerVoiceModelIds: ownerModels.map((entry) => entry.id),
        alreadyRecorded: true,
      });
    } catch (error) {
      await forgetRun(run.id);
      throw error;
    }
    if (!limit.ok) {
      await forgetRun(run.id);
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "VOICE_MODEL_RATE_LIMITED",
            message: limit.message,
            scope: limit.scope,
            retryAfterSeconds: limit.retryAfterSeconds,
          },
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
            "retry-after": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    try {
      const samples = await listVoiceModelSamples(model.id);
      const comparison = await runVoiceComparison({ model, samples, prompt: parsed.data.prompt });
      return jsonOk({ result: comparison.result, refused: comparison.refused });
    } catch (error) {
      await forgetRun(run.id);
      // No provider detail goes to the public.
      return jsonError(voiceModelFailureCode(error), "The model did not answer this time.", 502, {
        recoveryAction: "Try again in a minute.",
      });
    }
  } catch {
    return jsonError("VOICE_MODEL_FAILED", "The model did not answer this time.", 500);
  }
}
