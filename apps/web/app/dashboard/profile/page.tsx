import { GeminiStaticPage } from "@/components/gemini-static-page";
import { dashboardReplacements } from "../_lib";

export const dynamic = "force-dynamic";

export default async function DashboardProfilePage() {
  return <GeminiStaticPage template="dashboard/profile/index.html" replacements={await dashboardReplacements()} />;
}
