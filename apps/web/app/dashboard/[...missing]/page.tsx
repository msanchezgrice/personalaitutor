import { redirect } from "next/navigation";

/**
 * Catch-all for unknown /dashboard/* paths (live E2E fix 2026-07-07,
 * finding #2). Example: /dashboard/news (the real route is
 * /dashboard/ai-news).
 *
 * Without this, an unmatched dashboard path rendered the root 404 page while
 * the theme-boot script held `data-runtime-ready="0"` for every /dashboard
 * path — and since gemini-runtime.js (the script that flips that flag) only
 * loads on real dashboard pages, the first-paint spinner never released.
 *
 * Static segments always win over a catch-all in the App Router, so real
 * dashboard routes are unaffected.
 */
export default function UnknownDashboardPathPage() {
  redirect("/dashboard");
}
