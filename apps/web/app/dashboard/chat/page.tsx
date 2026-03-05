import { GeminiStaticPage } from "@/components/gemini-static-page";
import { getDashboardTemplateReplacements } from "@/lib/dashboard-template-replacements";

export default async function DashboardChatPage() {
  const replacements = await getDashboardTemplateReplacements();
  return <GeminiStaticPage template="dashboard/chat/index.html" replacements={replacements} />;
}
