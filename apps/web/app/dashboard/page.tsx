import { GeminiStaticPage } from "@/components/gemini-static-page";
import { FbCompleteRegistrationOnDashboard } from "@/components/fb-complete-registration-on-dashboard";
import { Suspense } from "react";
import { getDashboardTemplateReplacements } from "@/lib/dashboard-template-replacements";

export default async function DashboardPage() {
  const replacements = await getDashboardTemplateReplacements("dashboard/index.html");
  return (
    <>
      <Suspense fallback={null}>
        <FbCompleteRegistrationOnDashboard />
      </Suspense>
      <GeminiStaticPage template="dashboard/index.html" replacements={replacements} />
    </>
  );
}
