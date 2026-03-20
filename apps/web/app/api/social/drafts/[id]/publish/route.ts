import { jsonError, jsonOk, runtimePublishSocialDraft } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const userId = getUserId(req);
    if (!userId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }
    const access = await requireBillingAccess({ userId });
    if (!access.ok) {
      return access.response;
    }

    const mode = req.nextUrl.searchParams.get("mode");
    if (mode !== "api" && mode !== "composer") {
      return jsonError("INVALID_MODE", "mode must be api or composer", 400);
    }

    const result = await runtimePublishSocialDraft({
      draftId: id,
      mode,
      userId,
      forceFailCode: forcedFailCode(req),
    });

    if (!result.ok) {
      if (result.errorCode === "FORBIDDEN") {
        return jsonError("FORBIDDEN", "Draft access denied", 403);
      }
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
