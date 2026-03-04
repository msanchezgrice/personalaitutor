import { GeminiStaticPage } from "@/components/gemini-static-page";
import { FbCompleteRegistrationOnDashboard } from "@/components/fb-complete-registration-on-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return (
    <>
      <FbCompleteRegistrationOnDashboard />
      <GeminiStaticPage template="dashboard/index.html" />
    </>
  );
}
