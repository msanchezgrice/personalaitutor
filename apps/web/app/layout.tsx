import type { Metadata } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
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
const fbPixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim() || "1245045833736130";
const posthogProjectApiKey =
  process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "phc_tBkycftNmr65bgnAybwSHxcFQZDaLLIqc8TfUgu5E3y";
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

const posthogInitScript = buildPosthogInitScript(posthogProjectApiKey, posthogHost);

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkJsUrl = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script id="theme-boot" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script id="posthog-init" dangerouslySetInnerHTML={{ __html: posthogInitScript }} />
        {fbPixelScript ? (
          <script id="fb-pixel" dangerouslySetInnerHTML={{ __html: fbPixelScript }} />
        ) : null}
        <link rel="icon" href="/assets/branding/brand_brain_icon.svg" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
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
        <ClerkProvider clerkJSUrl={clerkJsUrl}>
          <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
          <Script src="/gemini-runtime.js" strategy="afterInteractive" />
          {children}
          <SpeedInsights />
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  );
}
