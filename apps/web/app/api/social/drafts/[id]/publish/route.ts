import { jsonError, jsonOk, runtimePublishSocialDraft } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { forcedFailCode } from "@/lib/api";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const mode = req.nextUrl.searchParams.get("mode");
    if (mode !== "api" && mode !== "composer") {
      return jsonError("INVALID_MODE", "mode must be api or composer", 400);
    }

    const result = await runtimePublishSocialDraft({
      draftId: id,
      mode,
      forceFailCode: forcedFailCode(req),
    });

    if (!result.ok) {
      return jsonError("SOCIAL_PUBLISH_FAILED", "Unable to publish draft", 409, {
        failureCode: result.errorCode,
        recoveryAction:
          result.errorCode === "OAUTH_NOT_CONNECTED"
            ? "Reconnect OAuth and retry publish"
            : "Retry publish once failure condition is resolved",
      });
    }

    return jsonOk({
      draft: result.draft,
      composerUrl: "composerUrl" in result ? result.composerUrl : undefined,
      publishedUrl: "publishedUrl" in result ? result.publishedUrl : undefined,
    });
  } catch (error) {
    return jsonError("SOCIAL_PUBLISH_FAILED", "Unable to publish draft", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
