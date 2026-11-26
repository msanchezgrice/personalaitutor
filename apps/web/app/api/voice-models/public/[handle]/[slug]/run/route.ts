import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { readJsonBody } from "@/lib/voice-model/access";
import { findPublicVoiceModel } from "@/lib/voice-model/public";
import { checkVoiceModelPublicRateLimit, hashVoiceModelRequestIp } from "@/lib/voice-model/rate-limit";
import { runVoiceComparison, voiceModelFailureCode } from "@/lib/voice-model/run";
import { runBodySchema } from "@/lib/voice-model/schemas";
import { listVoiceModelSamples, recordVoiceModelRun } from "@/lib/voice-model/store";

export const maxDuration = 120;

type Context = { params: Promise<{ handle: string; slug: string }> };

/**
 * Public "Try my model": a visitor's task through the base model and the
 * tuned model. Only for published models on published profiles. Limited per
 * hashed IP and per model; every attempt that passes the limit is counted,
 * whether or not the model calls succeed.
 */
export async function POST(req: NextRequest, context: Context) {
  try {
    const { handle, slug } = await context.params;
    const parsed = runBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Write a task of up to 400 characters.", 400);
    }
    const model = await findPublicVoiceModel({ handle: decodeURIComponent(handle), slug: decodeURIComponent(slug) });
    if (!model) {
      return jsonError("VOICE_MODEL_NOT_FOUND", "This model is not available.", 404);
    }

    const ipHash = hashVoiceModelRequestIp(req);
    const limit = await checkVoiceModelPublicRateLimit({ voiceModelId: model.id, ipHash });
    if (!limit.ok) {
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

    await recordVoiceModelRun({ voiceModelId: model.id, source: "public", ipHash, prompt: parsed.data.prompt });
    const samples = await listVoiceModelSamples(model.id);
    try {
      const comparison = await runVoiceComparison({ model, samples, prompt: parsed.data.prompt });
      return jsonOk({ result: comparison.result, refused: comparison.refused });
    } catch (error) {
      // No provider detail goes to the public.
      return jsonError(voiceModelFailureCode(error), "The model did not answer this time.", 502, {
        recoveryAction: "Try again in a minute.",
      });
    }
  } catch {
    return jsonError("VOICE_MODEL_FAILED", "The model did not answer this time.", 500);
  }
}
