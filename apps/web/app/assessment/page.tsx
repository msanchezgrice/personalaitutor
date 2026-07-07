import type { Metadata } from "next";
import { AnonymousAssessment } from "@/components/anonymous-assessment";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
} from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Free AI-Readiness Assessment`,
  description:
    "Take the free AI assessment — no account required. Get your 0-100 AI-readiness score, your skill gaps ranked by market impact, and a 30-day plan.",
  alternates: {
    canonical: "/assessment",
  },
  openGraph: {
    title: `${BRAND_NAME} | Free AI-Readiness Assessment`,
    description:
      "Get your 0-100 AI-readiness score, your skill gaps ranked by market impact, and a 30-day plan. No account required.",
    url: "/assessment",
    images: [{
      url: DEFAULT_OG_IMAGE_PATH,
      width: DEFAULT_OG_IMAGE_WIDTH,
      height: DEFAULT_OG_IMAGE_HEIGHT,
      alt: DEFAULT_OG_IMAGE_ALT,
      type: "image/png",
    }],
  },
  twitter: {
    card: "summary_large_image",
    site: BRAND_X_HANDLE,
    creator: BRAND_X_HANDLE,
    title: `${BRAND_NAME} | Free AI-Readiness Assessment`,
    description:
      "Get your 0-100 AI-readiness score, your skill gaps ranked by market impact, and a 30-day plan. No account required.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
};

export default function AssessmentPage() {
  return <AnonymousAssessment />;
}
