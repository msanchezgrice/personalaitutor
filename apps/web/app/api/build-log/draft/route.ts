import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { resolveBuildLogAccess } from "@/lib/build-log/access";
import { getBuildLogMapContext } from "@/lib/build-log/context";
import { draftBuildLogPost } from "@/lib/build-log/draft";
import { buildLogDraftBodySchema, readJsonBody } from "@/lib/build-log/schemas";

export const maxDuration = 120;

/**
 * "Draft from my notes". Returns a draft for the learner to review; nothing is
 * saved here. Hard-failure contract: no placeholder text on failure.
 */
export async function POST(req: NextRequest) {
  try {
    const access = await resolveBuildLogAccess(req);
    if (!access.ok) return access.response;
    const parsed = buildLogDraftBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Paste at least a few sentences of notes (up to 8,000 characters).", 400, {
        issues: parsed.error.issues,
      });
    }
    const context = await getBuildLogMapContext(access.profile.id);
    try {
      const { draft, model } = await draftBuildLogPost({
        notes: parsed.data.notes,
        title: parsed.data.title || null,
        context: { newTitle: context?.newTitle ?? null, previousTitle: context?.previousTitle ?? null },
      });
      return jsonOk({ draft, model });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN";
      const code = reason.startsWith("OPENAI_CONFIG_MISSING") ? "OPENAI_CONFIG_MISSING" : "BUILD_LOG_DRAFT_FAILED";
      return jsonError(code, "We could not draft your post right now.", 502, {
        reason: reason.slice(0, 300),
        recoveryAction: "Try again in a minute. Your notes are still here.",
      });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    return jsonError("BUILD_LOG_DRAFT_FAILED", "We could not draft your post right now.", 500, { reason: reason.slice(0, 300) });
  }
}
