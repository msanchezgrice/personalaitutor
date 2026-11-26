import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

const appBaseUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/employers", "/employers/talent", "/u/", "/map", "/remapped"],
        // "/map/" holds tokenised personal career maps; "/map" itself (the input page) stays crawlable.
        disallow: ["/dashboard", "/onboarding", "/sign-in", "/sign-up", "/api/", "/map/"],
      },
    ],
    sitemap: `${appBaseUrl}/sitemap.xml`,
  };
}
