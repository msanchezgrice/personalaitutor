import { createClient } from "@supabase/supabase-js";
import { jsonError, jsonOk, runtimeFindOnboardingSession } from "@/lib/runtime";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt"]);

function safeFilename(input: string) {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_ENV_MISSING");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureBucketExists(bucketName: string) {
  const supabase = getSupabaseAdminClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets ?? []).some((bucket) => bucket.name === bucketName);
  if (exists) return;
  const { error } = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: `${MAX_BYTES}`,
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`RESUME_BUCKET_CREATE_FAILED:${error.message}`);
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const sessionId = String(form.get("sessionId") ?? "").trim();
    const file = form.get("file");

    if (!sessionId) {
      return jsonError("INVALID_BODY", "sessionId is required", 400);
    }

    const session = await runtimeFindOnboardingSession(sessionId);
    if (!session) {
      return jsonError("SESSION_NOT_FOUND", "Onboarding session was not found", 404);
    }

    if (!(file instanceof File)) {
      return jsonError("FILE_REQUIRED", "Resume file is required", 400);
    }
    if (file.size <= 0) {
      return jsonError("FILE_EMPTY", "Uploaded file is empty", 400);
    }
    if (file.size > MAX_BYTES) {
      return jsonError("FILE_TOO_LARGE", "Resume exceeds 10MB limit", 400);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return jsonError("FILE_TYPE_NOT_ALLOWED", "Supported formats: PDF, DOC, DOCX, TXT", 400);
    }

    const supabase = getSupabaseAdminClient();
    const bucket = process.env.SUPABASE_RESUME_BUCKET?.trim() || "onboarding-resumes";
    await ensureBucketExists(bucket);

    const fileName = safeFilename(file.name || `resume.${ext}`);
    const objectPath = `onboarding/${sessionId}/${Date.now()}-${fileName}`;
    const contentType =
      file.type ||
      (ext === "pdf"
        ? "application/pdf"
        : ext === "doc"
          ? "application/msword"
          : ext === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "text/plain");

    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
      upsert: false,
      contentType,
      cacheControl: "31536000",
    });

    if (uploadError) {
      return jsonError("RESUME_UPLOAD_FAILED", "Unable to upload resume file", 500, {
        reason: uploadError.message,
      });
    }

    const now = new Date().toISOString();
    await supabase
      .from("onboarding_sessions")
      .update({
        resume_filename: fileName,
        updated_at: now,
      })
      .eq("id", sessionId);

    return jsonOk({
      resume: {
        filename: fileName,
        path: objectPath,
        bytes: file.size,
        mimeType: contentType,
        bucket,
      },
    });
  } catch (error) {
    return jsonError("RESUME_UPLOAD_FAILED", "Unable to upload resume file", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}

