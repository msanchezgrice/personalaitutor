import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/runtime";
import { RESUME_MAX_BYTES, ResumeExtractError, extractResumeText } from "@/lib/career-map/resume-extract";
import { checkResumeExtractRateLimit } from "@/lib/career-map/extract-rate-limit";
import { hashRequestIp } from "@/lib/career-map/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS_BY_CODE = {
  RESUME_FILE_TOO_LARGE: 413,
  RESUME_FILE_UNSUPPORTED: 415,
  RESUME_TEXT_NOT_FOUND: 422,
} as const;

const RECOVERY_BY_CODE = {
  RESUME_FILE_TOO_LARGE: "Upload a file under 4 MB, or paste the text.",
  RESUME_FILE_UNSUPPORTED: "Upload a PDF, .docx or .txt file, or paste the text.",
  RESUME_TEXT_NOT_FOUND: "Paste the text of your résumé instead.",
} as const;

/** POST multipart `file` -> `{ ok, text, chars, truncated }`. Nothing is stored. */
export async function POST(req: NextRequest) {
  try {
    // Per server instance only (in-process window): a speed bump, not a guarantee.
    const limit = checkResumeExtractRateLimit(hashRequestIp(req));
    if (!limit.ok) {
      const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
      const response = jsonError(
        "RESUME_EXTRACT_RATE_LIMITED",
        `You have uploaded ${limit.limit} files in the last few minutes. Wait about ${minutes} ${minutes === 1 ? "minute" : "minutes"} and try again, or paste the text instead.`,
        429,
        { retryAfterSeconds: limit.retryAfterSeconds, recoveryAction: "Paste the text of your résumé instead." },
      );
      response.headers.set("retry-after", String(limit.retryAfterSeconds));
      return response;
    }

    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    // Multipart framing adds a little; anything far past the cap is rejected before parsing.
    if (Number.isFinite(declaredLength) && declaredLength > RESUME_MAX_BYTES + 64 * 1024) {
      return jsonError("RESUME_FILE_TOO_LARGE", "That file is over 4 MB. Upload a smaller file, or paste the text.", 413, {
        maxBytes: RESUME_MAX_BYTES,
        recoveryAction: RECOVERY_BY_CODE.RESUME_FILE_TOO_LARGE,
      });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") {
      return jsonError("INVALID_BODY", "Choose a file to upload", 400, {
        recoveryAction: "Send the résumé as multipart form data in a field named file.",
      });
    }
    if (file.size > RESUME_MAX_BYTES) {
      return jsonError("RESUME_FILE_TOO_LARGE", "That file is over 4 MB. Upload a smaller file, or paste the text.", 413, {
        maxBytes: RESUME_MAX_BYTES,
        recoveryAction: RECOVERY_BY_CODE.RESUME_FILE_TOO_LARGE,
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await extractResumeText({
      fileName: "name" in file && typeof file.name === "string" ? file.name : "",
      mimeType: file.type || "",
      bytes,
    });

    return jsonOk({ text: result.text, chars: result.chars, truncated: result.truncated });
  } catch (error) {
    if (error instanceof ResumeExtractError) {
      return jsonError(error.code, error.message, STATUS_BY_CODE[error.code], {
        ...(error.code === "RESUME_FILE_TOO_LARGE" ? { maxBytes: RESUME_MAX_BYTES } : {}),
        recoveryAction: RECOVERY_BY_CODE[error.code],
      });
    }
    return jsonError("RESUME_EXTRACT_FAILED", "We could not read this file", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
      recoveryAction: RECOVERY_BY_CODE.RESUME_TEXT_NOT_FOUND,
    });
  }
}
