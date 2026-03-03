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
    title: `${BRAND_NAME} | Employer Portal`,
    description:
      "Browse and hire AI-native talent with proof-backed skills and project execution history.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
};

export default function EmployersPage() {
  return <GeminiStaticPage template="employers/index.html" />;
}
