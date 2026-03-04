import { GeminiStaticPage } from "@/components/gemini-static-page";

export const dynamic = "force-dynamic";

export default async function DashboardSocialPage() {
  return <GeminiStaticPage template="dashboard/social/index.html" />;
}
