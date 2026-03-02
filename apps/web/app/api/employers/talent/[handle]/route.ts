import { jsonError, jsonOk, runtimeGetTalentByHandle } from "@/lib/runtime";

export async function GET(_req: Request, context: { params: Promise<{ handle: string }> }) {
  const { handle } = await context.params;
  const candidate = await runtimeGetTalentByHandle(handle);
  if (!candidate) {
    return jsonError("CANDIDATE_NOT_FOUND", "Candidate was not found", 404);
  }

  return jsonOk({ candidate });
}
