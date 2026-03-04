import { GeminiStaticPage } from "@/components/gemini-static-page";

export const dynamic = "force-dynamic";

export default async function DashboardUpdatesPage() {
  return <GeminiStaticPage template="dashboard/updates/index.html" />;
}
