import type { Metadata } from "next";
import Script from "next/script";
import { themeBootScript } from "@/lib/theme-script";
import "./globals.css";

const appBaseUrl = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:6396")
).replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
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
      <head>
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <Script src="/gemini-runtime.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
