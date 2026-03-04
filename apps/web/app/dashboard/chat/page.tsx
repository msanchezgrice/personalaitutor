import { GeminiStaticPage } from "@/components/gemini-static-page";

export const dynamic = "force-dynamic";

export default async function DashboardChatPage() {
  return <GeminiStaticPage template="dashboard/chat/index.html" />;
}
