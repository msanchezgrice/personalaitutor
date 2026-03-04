import type { Metadata } from "next";
import { OnboardingIntake } from "@/components/onboarding-intake";
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
  return <OnboardingIntake />;
}
