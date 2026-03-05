import { GeminiStaticPage } from "@/components/gemini-static-page";
import { getDashboardTemplateReplacements } from "@/lib/dashboard-template-replacements";

export default async function DashboardProjectsPage() {
  const replacements = await getDashboardTemplateReplacements("dashboard/projects/index.html");
  return <GeminiStaticPage template="dashboard/projects/index.html" replacements={replacements} />;
}
