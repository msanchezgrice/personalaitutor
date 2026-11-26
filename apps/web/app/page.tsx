import type { Metadata } from "next";
import { HomePageTracking } from "@/components/home-page-tracking";
import { LandingPage } from "@/components/landing/landing-page";
import { LANDING_FAQS, LANDING_META_DESCRIPTION, LANDING_META_TITLE } from "@/components/landing/landing-content";
import { landingGuides, landingRemappedRoutes } from "@/components/landing/landing-data";
import { getAuthSeed } from "@/lib/auth";
import {
  BRAND_NAME,
  BRAND_LINKEDIN_URL,
  BRAND_X_HANDLE,
  BRAND_X_URL,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/site";

const appBaseUrl = getSiteUrl();
const ogImageUrl = `${appBaseUrl}${DEFAULT_OG_IMAGE_PATH}`;

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND_NAME,
  url: appBaseUrl,
  logo: `${appBaseUrl}/assets/branding/brand_brain_icon.svg`,
  sameAs: [BRAND_X_URL, BRAND_LINKEDIN_URL],
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: BRAND_NAME,
  url: appBaseUrl,
};

const homeFaqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LANDING_FAQS.map((entry) => ({
    "@type": "Question",
    name: entry.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: entry.answer,
    },
  })),
};

/** JSON for a <script type="application/ld+json">, with "<" escaped so no string can close the tag. */
function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const metadata: Metadata = {
  title: LANDING_META_TITLE,
  description: LANDING_META_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: LANDING_META_TITLE,
    description: LANDING_META_DESCRIPTION,
    url: appBaseUrl,
    images: [
      {
        url: ogImageUrl,
        width: DEFAULT_OG_IMAGE_WIDTH,
        height: DEFAULT_OG_IMAGE_HEIGHT,
        alt: DEFAULT_OG_IMAGE_ALT,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: BRAND_X_HANDLE,
    creator: BRAND_X_HANDLE,
    title: LANDING_META_TITLE,
    description: LANDING_META_DESCRIPTION,
    images: [ogImageUrl],
  },
  other: {
    "og:image": ogImageUrl,
    "twitter:image": ogImageUrl,
  },
};

// Per request: the header depends on the visitor's session, and the Remapped
// list on today's date.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // A failed session lookup must never take the landing page down: render signed out.
  const seed = await getAuthSeed().catch(() => null);
  const signedIn = Boolean(seed?.userId);

  return (
    <>
      <LandingPage signedIn={signedIn} remappedRoutes={landingRemappedRoutes()} guides={landingGuides()} />
      <HomePageTracking />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organizationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(websiteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(homeFaqLd) }} />
    </>
  );
}
