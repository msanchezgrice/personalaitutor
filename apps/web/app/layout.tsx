import type { Metadata } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { BRAND_NAME, BRAND_DOMAIN, getSiteUrl } from "@/lib/site";
import { themeBootScript } from "@/lib/theme-script";
import "./globals.css";
const appBaseUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  applicationName: BRAND_NAME,
  icons: {
    icon: "/assets/branding/brand_logo_icon.png",
    shortcut: "/assets/branding/brand_logo_icon.png",
    apple: "/assets/branding/brand_logo_icon.png",
  },
  title: {
    default: `${BRAND_NAME} | Build AI Skills and Public Proof`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: "Learn AI, build proof artifacts, and publish system-verified skills.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${BRAND_NAME} | Build AI Skills and Public Proof`,
    description: "Learn AI and publish proof-based profiles.",
    siteName: BRAND_NAME,
    type: "website",
    url: "/",
    images: [{ url: "/assets/social_media_banner.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | Build AI Skills and Public Proof`,
    description: "Learn AI and publish proof-based profiles.",
    images: ["/assets/social_media_banner.png"],
  },
  keywords: [
    "AI tutor",
    "AI skills",
    "AI assessment",
    "AI portfolio",
    "talent marketplace",
    BRAND_DOMAIN,
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkJsUrl = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";

  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="icon" href="/assets/branding/brand_logo_icon.png" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
        <ClerkProvider clerkJSUrl={clerkJsUrl}>
          <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
          <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
          <Script src="/gemini-runtime.js" strategy="afterInteractive" />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
