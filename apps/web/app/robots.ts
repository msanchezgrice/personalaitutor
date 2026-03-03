import type { MetadataRoute } from "next";

const appBaseUrl = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:6396")
).replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/assessment", "/onboarding", "/employers", "/employers/talent", "/u/"],
        disallow: ["/dashboard"],
      },
    ],
    sitemap: `${appBaseUrl}/sitemap.xml`,
  };
}
