import { GeminiStaticPage } from "@/components/gemini-static-page";
import { getDashboardTemplateReplacements } from "@/lib/dashboard-template-replacements";

export default async function DashboardProfilePage() {
  const replacements = await getDashboardTemplateReplacements("dashboard/profile/index.html");
  return <GeminiStaticPage template="dashboard/profile/index.html" replacements={replacements} />;
}
