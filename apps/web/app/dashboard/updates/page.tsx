import { GeminiStaticPage } from "@/components/gemini-static-page";
import { dashboardReplacements } from "../_lib";

export default async function DashboardUpdatesPage() {
  return <GeminiStaticPage template="dashboard/updates/index.html" replacements={await dashboardReplacements()} />;
}
