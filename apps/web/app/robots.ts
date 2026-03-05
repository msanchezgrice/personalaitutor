import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

const appBaseUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/employers", "/employers/talent", "/u/"],
        disallow: ["/dashboard", "/onboarding", "/sign-in", "/sign-up", "/api/"],
      },
    ],
    sitemap: `${appBaseUrl}/sitemap.xml`,
  };
}
