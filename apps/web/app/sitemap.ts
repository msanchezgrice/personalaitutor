import type { MetadataRoute } from "next";

const appBaseUrl = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:6396")
).replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${appBaseUrl}/` },
    { url: `${appBaseUrl}/assessment` },
    { url: `${appBaseUrl}/onboarding` },
    { url: `${appBaseUrl}/employers` },
    { url: `${appBaseUrl}/employers/talent` },
    { url: `${appBaseUrl}/employers/talent/candidate-001` },
    { url: `${appBaseUrl}/u/test-user-0001` },
    { url: `${appBaseUrl}/u/test-user-0001/projects/project-alpha-001` },
  ];
}
