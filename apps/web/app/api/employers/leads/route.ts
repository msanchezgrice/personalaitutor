import { jsonError, jsonOk, runtimeCreateEmployerLead, runtimeGetTalentByHandle } from "@/lib/runtime";
import { z } from "zod";

const schema = z.object({
  employerName: z.string().min(2).max(120),
  employerEmail: z.string().email(),
  handle: z.string().min(2),
  note: z.string().min(4).max(500),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid employer lead payload", 400, { issues: parsed.error.issues });
  }

  const exists = await runtimeGetTalentByHandle(parsed.data.handle);
  if (!exists) {
    return jsonError("CANDIDATE_NOT_FOUND", "Cannot create lead for unknown candidate", 404);
  }

  const lead = await runtimeCreateEmployerLead(parsed.data);
  return jsonOk({ lead }, { status: 201 });
}
