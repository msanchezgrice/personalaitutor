import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";

export const metadata: Metadata = {
  title: "Architecture Overview | My AI Skill Tutor",
  description: "Internal architecture coverage map for the My AI Skill Tutor product surface.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ArchitecturePage() {
  return <GeminiStaticPage template="architecture/index.html" />;
}
