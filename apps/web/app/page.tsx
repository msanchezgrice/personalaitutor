import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Learn Fast and Prove It Publicly`,
  description:
    "Your dedicated AI copilot for career growth. Build AI workflows, complete modules, and publish public proof.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${BRAND_NAME} | Learn Fast and Prove It Publicly`,
    description:
      "Build AI workflows, verify your skills, and generate a public profile employers can trust.",
    url: "/",
    images: [{ url: "/assets/social_media_banner.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | Learn Fast and Prove It Publicly`,
    description:
      "Build AI workflows, verify your skills, and generate a public profile employers can trust.",
    images: ["/assets/social_media_banner.png"],
  },
};

export default function HomePage() {
  return <GeminiStaticPage template="index.html" />;
}
