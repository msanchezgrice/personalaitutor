import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
} from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Talent Marketplace`,
  description:
    "Search AI-native candidates by verified skills, tools, and project evidence from public proof profiles.",
  alternates: {
    canonical: "/employers/talent",
  },
  openGraph: {
    title: `${BRAND_NAME} | Talent Marketplace`,
    description:
      "Search AI-native candidates by verified skills, tools, and project evidence from public proof profiles.",
    url: "/employers/talent",
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
    title: `${BRAND_NAME} | Talent Marketplace`,
    description:
      "Search AI-native candidates by verified skills, tools, and project evidence from public proof profiles.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
};

export default function TalentPage() {
  return <GeminiStaticPage template="employers/talent/index.html" />;
}
