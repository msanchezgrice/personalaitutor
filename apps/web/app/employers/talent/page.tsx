import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { BRAND_NAME } from "@/lib/site";

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
    images: [{ url: "/assets/social_media_banner.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | Talent Marketplace`,
    description:
      "Search AI-native candidates by verified skills, tools, and project evidence from public proof profiles.",
    images: ["/assets/social_media_banner.png"],
  },
};

export default function TalentPage() {
  return <GeminiStaticPage template="employers/talent/index.html" />;
}
