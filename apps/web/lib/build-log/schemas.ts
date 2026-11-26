import { z } from "zod";
import { BUILD_LOG_BODY_MAX, BUILD_LOG_TITLE_MAX } from "@aitutor/shared";
import { BUILD_LOG_NOTES_MAX_CHARS, BUILD_LOG_NOTES_MIN_CHARS, BUILD_LOG_SUMMARY_MAX } from "@/lib/build-log/limits";

/** Request bodies for /api/build-log routes. */

export const buildLogCreateBodySchema = z.object({
  title: z.string().trim().min(1).max(BUILD_LOG_TITLE_MAX),
  summary: z.string().max(BUILD_LOG_SUMMARY_MAX).optional(),
  bodyMarkdown: z.string().max(BUILD_LOG_BODY_MAX).optional(),
});

export const buildLogPatchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(BUILD_LOG_TITLE_MAX).optional(),
    summary: z.string().max(BUILD_LOG_SUMMARY_MAX).optional(),
    bodyMarkdown: z.string().max(BUILD_LOG_BODY_MAX).optional(),
  })
  .refine((value) => value.title !== undefined || value.summary !== undefined || value.bodyMarkdown !== undefined, {
    message: "NOTHING_TO_UPDATE",
  });

export const buildLogPublishBodySchema = z.object({ published: z.boolean() });

export const buildLogDraftBodySchema = z.object({
  notes: z.string().trim().min(BUILD_LOG_NOTES_MIN_CHARS).max(BUILD_LOG_NOTES_MAX_CHARS),
  title: z.string().trim().max(BUILD_LOG_TITLE_MAX).optional(),
});

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
