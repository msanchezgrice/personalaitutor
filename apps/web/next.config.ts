import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const repoEnv = fileURLToPath(new URL("../../.env", import.meta.url));

try {
  process.loadEnvFile(repoEnv);
} catch {
  // Local root-level env is optional.
}

const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typedRoutes: true,
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://*.posthog.com https://connect.facebook.net https://snap.licdn.com https://static.ads-twitter.com https://va.vercel-scripts.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.myaiskilltutor.com https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com",
      "connect-src 'self' https://api.openai.com https://api.resend.com https://api.linkedin.com https://www.linkedin.com https://api.twitter.com https://*.posthog.com https://www.facebook.com https://connect.facebook.net https://px.ads.linkedin.com https://analytics.twitter.com https://ads-twitter.com https://vitals.vercel-insights.com https://*.clerk.com https://clerk.myaiskilltutor.com",
      "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.myaiskilltutor.com https://challenges.cloudflare.com https://share.synthesia.io https://app.synthesia.io",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default config;
