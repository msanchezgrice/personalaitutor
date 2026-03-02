import { jsonError, jsonOk, runtimeCreateProject } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";

const schema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(8).max(1000),
  slug: z.string().min(2).max(120).optional(),
  userId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid project payload", 400, { issues: parsed.error.issues });
  }

  const userId = parsed.data.userId ?? getUserId(req);
  const project = await runtimeCreateProject({
    userId,
    title: parsed.data.title,
    description: parsed.data.description,
    slug: parsed.data.slug,
  });

  if (!project) {
    return jsonError("USER_NOT_FOUND", "Project creation requires a valid user", 404);
  }

  return jsonOk({ project }, { status: 201 });
}
