export const BRAND_NAME = "My AI Skill Tutor";
export const BRAND_DOMAIN = "myaiskilltutor.com";
export const DEFAULT_CANONICAL_URL = "https://www.myaiskilltutor.com";
export const BRAND_X_HANDLE = "@myaiskilltu";
export const BRAND_X_URL = "https://x.com/myaiskilltutor";
export const BRAND_LINKEDIN_URL = "https://www.linkedin.com/company/myaiskilltutor";
export const DEFAULT_OG_IMAGE_PATH = "/assets/og_default_1200x630.png";
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_ALT = `${BRAND_NAME} platform preview`;

export function getSiteUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : DEFAULT_CANONICAL_URL)
  ).replace(/\/+$/, "");
}
