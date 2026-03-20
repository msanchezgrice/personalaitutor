import { createClient } from "@supabase/supabase-js";
import { jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById, runtimeRecordProjectArtifact } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "pdf", "txt"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

function storageMode() {
  const explicit = process.env.PERSISTENCE_MODE?.trim().toLowerCase();
  if (explicit === "memory" || explicit === "supabase") return explicit;
  const hasSupabaseCreds = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
  );
  return hasSupabaseCreds ? "supabase" : "memory";
}

function safeFilename(input: string) {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function summarizeNote(value: string | null | undefined) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > 120 ? `${cleaned.slice(0, 117).trim()}...` : cleaned;
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
    public: true,
    fileSizeLimit: `${MAX_BYTES}`,
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`PROJECT_PROOF_BUCKET_CREATE_FAILED:${error.message}`);
  }
}

function mimeTypeForUpload(file: File, ext: string) {
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return file.type;
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

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

    const [profile, project] = await Promise.all([
      runtimeFindUserById(userId),
      runtimeFindProjectById(id),
    ]);
    if (!profile) {
      return jsonError("USER_NOT_FOUND", "Profile was not found", 404);
    }
    if (!project) {
      return jsonError("PROJECT_NOT_FOUND", "Project was not found", 404);
    }
    if (project.userId !== profile.id) {
      return jsonError("FORBIDDEN", "Project access denied", 403);
    }

    const form = await req.formData();
    const note = String(form.get("note") ?? "").trim();
    const stepKey = String(form.get("stepKey") ?? "").trim();
    const file = form.get("file");
    const step = stepKey ? project.moduleSteps.find((entry) => entry.stepKey === stepKey) ?? null : null;
    if (stepKey && !step) {
      return jsonError("STEP_NOT_FOUND", "Module step was not found", 404);
    }

    if (!(file instanceof File)) {
      return jsonError("FILE_REQUIRED", "Proof file is required", 400);
    }
    if (file.size <= 0) {
      return jsonError("FILE_EMPTY", "Uploaded file is empty", 400);
    }
    if (file.size > MAX_BYTES) {
      return jsonError("FILE_TOO_LARGE", "Proof file exceeds 10MB limit", 400);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return jsonError("FILE_TYPE_NOT_ALLOWED", "Supported formats: PNG, JPG, JPEG, WEBP, PDF, TXT", 400);
    }
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return jsonError("FILE_TYPE_NOT_ALLOWED", "Supported formats: PNG, JPG, JPEG, WEBP, PDF, TXT", 400);
    }

    const fileName = safeFilename(file.name || `proof.${ext}`);
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = mimeTypeForUpload(file, ext);
    const isMemoryStorage = storageMode() === "memory";
    let publicUrl = "";
    let bucket: string | null = null;
    let objectPath: string | null = null;

    if (isMemoryStorage) {
      publicUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
    } else {
      const supabase = getSupabaseAdminClient();
      bucket = process.env.SUPABASE_PROJECT_PROOF_BUCKET?.trim() || "project-proof-artifacts";
      await ensureBucketExists(bucket);

      objectPath = `projects/${project.id}/${Date.now()}-${fileName}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
        upsert: false,
        contentType: mimeType,
        cacheControl: "31536000",
      });
      if (uploadError) {
        return jsonError("PROJECT_PROOF_UPLOAD_FAILED", "Unable to upload proof file", 500, {
          reason: uploadError.message,
        });
      }

      publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
    }

    const artifact = await runtimeRecordProjectArtifact({
      projectId: project.id,
      userId,
      kind: "proof_upload",
      url: publicUrl,
      logMessage: note
        ? `Proof file uploaded${step ? ` for ${step.title}` : ""}: ${fileName}. ${summarizeNote(note)}`
        : `Proof file uploaded${step ? ` for ${step.title}` : ""}: ${fileName}`,
      metadata: {
        source: "proof_upload",
        bucket,
        objectPath,
        storageMode: isMemoryStorage ? "memory" : "supabase",
        originalFileName: file.name,
        note: note || null,
        stepKey: step?.stepKey ?? null,
        stepTitle: step?.title ?? null,
      },
      awardTokens: 180,
    });

    if (!artifact) {
      return jsonError("PROJECT_PROOF_UPLOAD_FAILED", "Unable to register proof file", 409);
    }

    return jsonOk({
      project: artifact,
      artifact: {
        kind: "proof_upload",
        url: publicUrl,
        filename: fileName,
        bytes: file.size,
        stepKey: step?.stepKey ?? null,
      },
    });
  } catch (error) {
    return jsonError("PROJECT_PROOF_UPLOAD_FAILED", "Unable to upload proof file", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
