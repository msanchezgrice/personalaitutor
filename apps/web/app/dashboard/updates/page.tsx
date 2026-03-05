import { GeminiStaticPage } from "@/components/gemini-static-page";
import { getDashboardTemplateReplacements } from "@/lib/dashboard-template-replacements";

export default async function DashboardUpdatesPage() {
  const replacements = await getDashboardTemplateReplacements("dashboard/updates/index.html");
  return <GeminiStaticPage template="dashboard/updates/index.html" replacements={replacements} />;
}
