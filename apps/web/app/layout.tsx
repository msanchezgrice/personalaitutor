import type { Metadata } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import {
  BRAND_NAME,
  BRAND_DOMAIN,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/site";
import { themeBootScript } from "@/lib/theme-script";
import "./globals.css";
const appBaseUrl = getSiteUrl();
const facebookAppId = process.env.FACEBOOK_APP_ID?.trim() || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim();
const defaultOgImageUrl = `${appBaseUrl}${DEFAULT_OG_IMAGE_PATH}`;

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
    locale: "en_US",
    type: "website",
    url: "/",
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
    title: `${BRAND_NAME} | Build AI Skills and Public Proof`,
    description: "Learn AI and publish proof-based profiles.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
  other: {
    "og:image:secure_url": defaultOgImageUrl,
    "og:image:width": String(DEFAULT_OG_IMAGE_WIDTH),
    "og:image:height": String(DEFAULT_OG_IMAGE_HEIGHT),
    "og:image:alt": DEFAULT_OG_IMAGE_ALT,
    ...(facebookAppId ? { "fb:app_id": facebookAppId } : {}),
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
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script id="theme-boot" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="icon" href="/assets/branding/brand_logo_icon.png" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
        <ClerkProvider clerkJSUrl={clerkJsUrl}>
          <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
          <Script src="/gemini-runtime.js" strategy="afterInteractive" />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
