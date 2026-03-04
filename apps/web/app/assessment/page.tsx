import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
} from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | AI Assessment`,
  description: "Take the AI assessment to generate your personalized skill path and dashboard plan.",
  alternates: {
    canonical: "/assessment",
  },
  openGraph: {
    title: `${BRAND_NAME} | AI Assessment`,
    description: "Take the AI assessment to generate your personalized skill path and dashboard plan.",
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
    title: `${BRAND_NAME} | AI Assessment`,
    description: "Take the AI assessment to generate your personalized skill path and dashboard plan.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AssessmentPage() {
  redirect("/onboarding");
}
