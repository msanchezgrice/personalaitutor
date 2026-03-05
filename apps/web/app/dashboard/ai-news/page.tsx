import { GeminiStaticPage } from "@/components/gemini-static-page";
import { getDashboardTemplateReplacements } from "@/lib/dashboard-template-replacements";

export default async function DashboardAiNewsPage() {
  const replacements = await getDashboardTemplateReplacements("dashboard/ai-news/index.html");
  return <GeminiStaticPage template="dashboard/ai-news/index.html" replacements={replacements} />;
}
