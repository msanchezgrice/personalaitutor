import { GeminiStaticPage } from "@/components/gemini-static-page";
import { dashboardReplacements } from "../_lib";

export const dynamic = "force-dynamic";

export default async function DashboardSocialPage() {
  return <GeminiStaticPage template="dashboard/social/index.html" replacements={await dashboardReplacements()} />;
}
