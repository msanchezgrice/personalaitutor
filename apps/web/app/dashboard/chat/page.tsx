import { GeminiStaticPage } from "@/components/gemini-static-page";
import { dashboardReplacements } from "../_lib";

export default async function DashboardChatPage() {
  return <GeminiStaticPage template="dashboard/chat/index.html" replacements={await dashboardReplacements()} />;
}
