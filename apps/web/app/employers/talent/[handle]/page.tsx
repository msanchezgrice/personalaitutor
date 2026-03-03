import { GeminiStaticPage } from "@/components/gemini-static-page";
import { runtimeGetTalentByHandle } from "@/lib/runtime";

export default async function TalentDetailPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const found = await runtimeGetTalentByHandle(handle);
  const candidate =
    found ??
    (handle === "alex-chen-ai"
      ? {
          handle: "alex-chen-ai",
          name: "Alex Chen",
          careerType: "Employed",
          role: "Product Manager",
          status: "verified" as const,
          topSkills: ["Prompt Engineering", "API Integrations"],
          topTools: ["Python", "Cursor IDE"],
          evidenceScore: 83,
        }
      : null);

  if (!candidate) {
    return (
      <main className="min-h-screen bg-[#0f111a] text-white p-10">
        <h1 className="text-2xl font-bold">Candidate not found</h1>
        <p className="text-gray-400 mt-2">Invalid handle for talent profile.</p>
      </main>
    );
  }

  const replacements: Record<string, string> = {
    "/u/alex-chen-ai/": `/u/${candidate.handle}/`,
    "Alex Chen": candidate.name,
    "Product Manager based in San Francisco, CA": `${candidate.role} (${candidate.careerType})`,
  };

  if (candidate.topSkills[0]) {
    replacements["Prompt Engineering"] = candidate.topSkills[0];
  }
  if (candidate.topSkills[1]) {
    replacements["Python Scripting"] = candidate.topSkills[1];
  }
  if (candidate.topTools[0]) {
    replacements["Cursor IDE"] = candidate.topTools[0];
  }

  return <GeminiStaticPage template="employers/talent/alex-chen-ai/index.html" replacements={replacements} />;
}
