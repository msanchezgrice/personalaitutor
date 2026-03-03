import { GeminiStaticPage } from "@/components/gemini-static-page";
import { dashboardReplacements } from "../_lib";

export default async function DashboardProjectsPage() {
  return <GeminiStaticPage template="dashboard/projects/index.html" replacements={await dashboardReplacements()} />;
}
