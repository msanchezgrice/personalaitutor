import { GeminiStaticPage } from "@/components/gemini-static-page";
import { FbCompleteRegistrationOnDashboard } from "@/components/fb-complete-registration-on-dashboard";
import { Suspense } from "react";

export default async function DashboardPage() {
  return (
    <>
      <Suspense fallback={null}>
        <FbCompleteRegistrationOnDashboard />
      </Suspense>
      <GeminiStaticPage template="dashboard/index.html" />
    </>
  );
}
