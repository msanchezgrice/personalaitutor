import type { Metadata } from "next";
import { themeBootScript } from "@/lib/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:6396"),
  title: "AI Tutor Platform",
  description: "Learn AI, build proof artifacts, and publish system-verified skills.",
  openGraph: {
    title: "AI Tutor Platform",
    description: "Learn AI and publish proof-based profiles.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Tutor Platform",
    description: "Learn AI and publish proof-based profiles.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
      </body>
    </html>
  );
}
