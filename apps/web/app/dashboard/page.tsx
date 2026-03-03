import { GeminiStaticPage } from "@/components/gemini-static-page";
import { dashboardReplacements } from "./_lib";

export default async function DashboardPage() {
  return <GeminiStaticPage template="dashboard/index.html" replacements={await dashboardReplacements()} />;
}
