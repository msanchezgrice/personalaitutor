export const BRAND_NAME = "My AI Skill Tutor";
export const BRAND_DOMAIN = "myaiskilltutor.com";
export const DEFAULT_CANONICAL_URL = "https://mypersonalaitutor.com";

export function getSiteUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : DEFAULT_CANONICAL_URL)
  ).replace(/\/+$/, "");
}

