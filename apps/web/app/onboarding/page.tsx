import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Onboarding`,
  description: "Set your career path and goals to initialize your AI tutor workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingPage() {
  return (
    <GeminiStaticPage
      template="onboarding/index.html"
      className="relative min-h-screen bg-[#0f111a] text-white flex items-center justify-center py-12 px-6 overflow-hidden"
    />
  );
}
