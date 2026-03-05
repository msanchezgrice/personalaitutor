import { GeminiStaticPage } from "@/components/gemini-static-page";
import { getDashboardTemplateReplacements } from "@/lib/dashboard-template-replacements";

export default async function DashboardSocialPage() {
  const replacements = await getDashboardTemplateReplacements();
  return <GeminiStaticPage template="dashboard/social/index.html" replacements={replacements} />;
}
