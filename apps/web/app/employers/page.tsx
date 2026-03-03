import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Employer Portal`,
  description:
    "Hire verified AI-native talent with proof-backed project history, build logs, and validated skill signals.",
  alternates: {
    canonical: "/employers",
  },
  openGraph: {
    title: `${BRAND_NAME} | Employer Portal`,
    description:
      "Browse and hire AI-native talent with proof-backed skills and project execution history.",
    url: "/employers",
    images: [{ url: "/assets/social_media_banner.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | Employer Portal`,
    description:
      "Browse and hire AI-native talent with proof-backed skills and project execution history.",
    images: ["/assets/social_media_banner.png"],
  },
};

export default function EmployersPage() {
  return <GeminiStaticPage template="employers/index.html" />;
}
