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
const LOCAL_DEV_URL = "http://localhost:6396";
const CANONICAL_HOST = "www.myaiskilltutor.com";
const CANONICAL_HOST_ALIASES = new Set(["myaiskilltutor.com", CANONICAL_HOST]);

function normalizeSiteUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_CANONICAL_URL;

  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (CANONICAL_HOST_ALIASES.has(url.hostname)) {
      url.protocol = "https:";
      url.hostname = CANONICAL_HOST;
      url.port = "";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

export function getSiteUrl() {
  const explicit = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return normalizeSiteUrl(explicit);

  if (process.env.VERCEL_URL) return normalizeSiteUrl(process.env.VERCEL_URL);

  if (process.env.NODE_ENV !== "production") return LOCAL_DEV_URL;

  return DEFAULT_CANONICAL_URL;
}
