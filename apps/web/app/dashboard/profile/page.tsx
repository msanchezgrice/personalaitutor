import { GeminiStaticPage } from "@/components/gemini-static-page";

export const dynamic = "force-dynamic";

export default async function DashboardProfilePage() {
  return <GeminiStaticPage template="dashboard/profile/index.html" />;
}
