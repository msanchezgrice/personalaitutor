import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { AuthCompletionTracker } from "@/components/auth-completion-tracker";
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
import { attributionCaptureScript } from "@/lib/attribution";
import { themeBootScript } from "@/lib/theme-script";
import "./globals.css";
const appBaseUrl = getSiteUrl();
const facebookAppId = process.env.FACEBOOK_APP_ID?.trim() || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim();
const defaultOgImageUrl = `${appBaseUrl}${DEFAULT_OG_IMAGE_PATH}`;
const fbPixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim() || "";
const googleAdsTagId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID?.trim() || "";
const linkedinPartnerId = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID?.trim() || "";
const xPixelId = process.env.NEXT_PUBLIC_X_PIXEL_ID?.trim() || process.env.NEXT_PUBLIC_TWITTER_PIXEL_ID?.trim() || "";
const posthogProjectApiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "";
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

function buildPosthogInitScript(apiKey: string, host: string) {
  const safeApiKey = JSON.stringify(apiKey);
  const safeHost = JSON.stringify(host);

  return `
!function(t,e){
var o,n,p,r;
e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){
function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)));};}
(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);
var u=e;
void 0!==a?u=e[a]=[]:a="posthog";
u.people=u.people||[];
u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e;};
u.people.toString=function(){return u.toString(1)+".people (stub)";};
o="capture identify alias people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove_group people.setPersonProperties reset";
for(n=0;n<o.split(" ").length;n++)g(u,o.split(" ")[n]);
e._i.push([i,s,a]);
},e.__SV=1);
}(document,window.posthog||[]);
window.posthog.init(${safeApiKey},{
api_host:${safeHost},
capture_pageview:true,
autocapture:true,
capture_pageleave:true,
persistence:"localStorage+cookie",
person_profiles:"identified_only"
});
`;
}

const posthogInitScript = posthogProjectApiKey ? buildPosthogInitScript(posthogProjectApiKey, posthogHost) : "";
const disableClerkForPrototypeInLocalDev =
  process.env.NODE_ENV === "development" &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim().startsWith("pk_live_") ?? false);
const clerkLocalization = {
  signIn: {
    start: {
      title: `Sign in to ${BRAND_NAME}`,
      subtitle: "Welcome back! Please sign in to continue",
    },
  },
  signUp: {
    start: {
      title: `Create your ${BRAND_NAME} account`,
      subtitle: "Use social login for the fastest setup",
    },
  },
};

function buildFbPixelScript(pixelId: string) {
  if (!pixelId) return "";
  const safeId = JSON.stringify(pixelId);
  return `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${safeId});
fbq('track', 'PageView');
`;
}

const fbPixelScript = buildFbPixelScript(fbPixelId);

function buildGoogleAdsInitScript(tagId: string) {
  if (!tagId) return "";
  const safeTagId = JSON.stringify(tagId);
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
gtag('config', ${safeTagId});
`;
}

const googleAdsInitScript = buildGoogleAdsInitScript(googleAdsTagId);

function buildLinkedInInsightScript(partnerId: string) {
  if (!partnerId) return "";
  const safePartnerId = JSON.stringify(partnerId);
  return `
window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
window._linkedin_data_partner_ids.push(${safePartnerId});
(function(l){
if (l.linkedin_insight_tag) return;
var s = document.getElementsByTagName("script")[0];
var b = document.createElement("script");
b.type = "text/javascript"; b.async = true;
b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
s.parentNode.insertBefore(b, s);
})(window);
`;
}

function buildXPixelScript(pixelId: string) {
  if (!pixelId) return "";
  const safePixelId = JSON.stringify(pixelId);
  return `
!function(e,t,n,s,u,a){
e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},
s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a));
}(window,document,'script');
twq('config', ${safePixelId});
`;
}

const linkedinInsightScript = buildLinkedInInsightScript(linkedinPartnerId);
const xTrackingScript = buildXPixelScript(xPixelId);

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  applicationName: BRAND_NAME,
  icons: {
    icon: "/assets/branding/brand_brain_icon.svg",
    shortcut: "/assets/branding/brand_brain_icon.svg",
    apple: "/assets/branding/brand_brain_icon.svg",
  },
  title: {
    default: `${BRAND_NAME} | Build AI Skills and Public Proof`,
    template: "%s",
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
      url: defaultOgImageUrl,
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
    images: [defaultOgImageUrl],
  },
  other: {
    "og:url": appBaseUrl,
    "og:image": defaultOgImageUrl,
    "og:image:secure_url": defaultOgImageUrl,
    "og:image:width": String(DEFAULT_OG_IMAGE_WIDTH),
    "og:image:height": String(DEFAULT_OG_IMAGE_HEIGHT),
    "og:image:alt": DEFAULT_OG_IMAGE_ALT,
    "twitter:image": defaultOgImageUrl,
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const shouldDisableClerk = disableClerkForPrototypeInLocalDev && pathname.startsWith("/chat-onboarding-prototype");

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script id="attribution-capture" dangerouslySetInnerHTML={{ __html: attributionCaptureScript }} />
        <script id="theme-boot" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {posthogInitScript ? (
          <script id="posthog-init" dangerouslySetInnerHTML={{ __html: posthogInitScript }} />
        ) : null}
        {fbPixelScript ? (
          <script id="fb-pixel" dangerouslySetInnerHTML={{ __html: fbPixelScript }} />
        ) : null}
        {googleAdsTagId ? (
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAdsTagId)}`}></script>
        ) : null}
        {googleAdsInitScript ? (
          <script id="google-ads-tag" dangerouslySetInnerHTML={{ __html: googleAdsInitScript }} />
        ) : null}
        {linkedinInsightScript ? (
          <script id="linkedin-insight" dangerouslySetInnerHTML={{ __html: linkedinInsightScript }} />
        ) : null}
        {xTrackingScript ? (
          <script id="x-pixel" dangerouslySetInnerHTML={{ __html: xTrackingScript }} />
        ) : null}
        <link rel="icon" href="/assets/branding/brand_brain_icon.svg" />
        <link rel="preload" href="/styles.css" as="style" />
        <link id="app-shared-stylesheet" rel="stylesheet" href="/styles.css" fetchPriority="high" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body suppressHydrationWarning>
        <div data-shell-loader="1" aria-hidden="true">
          <div className="first-paint-loader">
            <div className="first-paint-loader__brand">
              <img
                src="/assets/branding/brand_brain_icon.svg"
                alt=""
                className="first-paint-loader__icon"
              />
              <span>My AI Skill Tutor</span>
            </div>
            <div className="first-paint-loader__spinner"></div>
          </div>
        </div>
        {fbPixelId ? (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${encodeURIComponent(fbPixelId)}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        ) : null}
        {linkedinPartnerId ? (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://px.ads.linkedin.com/collect/?pid=${encodeURIComponent(linkedinPartnerId)}&fmt=gif`}
              alt=""
            />
          </noscript>
        ) : null}
        {shouldDisableClerk ? (
          <>
            <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
            {children}
            <SpeedInsights />
            <Analytics />
          </>
        ) : (
          <ClerkProvider localization={clerkLocalization}>
            <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
            <AuthCompletionTracker />
            {children}
            <SpeedInsights />
            <Analytics />
          </ClerkProvider>
        )}
      </body>
    </html>
  );
}
