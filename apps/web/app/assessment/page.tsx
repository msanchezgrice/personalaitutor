import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | AI Assessment`,
  description: "Take the AI assessment to generate your personalized skill path and dashboard plan.",
  alternates: {
    canonical: "/assessment",
  },
};

export default function AssessmentPage() {
  return <GeminiStaticPage template="assessment/index.html" />;
}
