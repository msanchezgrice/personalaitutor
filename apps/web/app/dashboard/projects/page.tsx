import { GeminiStaticPage } from "@/components/gemini-static-page";

export const dynamic = "force-dynamic";

export default async function DashboardProjectsPage() {
  return <GeminiStaticPage template="dashboard/projects/index.html" />;
}
