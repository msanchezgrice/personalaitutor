import { expect, test as setup } from "@playwright/test";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { clerkAuthStatePath, clerkE2EEmail, ensureClerkAuthStateDir, ensureClerkE2EUser, hasClerkAuthEnv } from "./clerk-auth";

function shouldSkipLocalAuth(baseURL: string) {
  return (
    (baseURL.includes("localhost") || baseURL.includes("127.0.0.1"))
    && process.env.PLAYWRIGHT_ALLOW_LOCAL_CLERK_AUTH !== "1"
  );
}

setup("authenticate dashboard test user", async ({ page }, testInfo) => {
  setup.skip(!hasClerkAuthEnv(), "Clerk auth setup requires CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.");

  const baseURL = String(testInfo.project.use?.baseURL || "");
  setup.skip(
    shouldSkipLocalAuth(baseURL),
    "Local Clerk auth is opt-in. Set PLAYWRIGHT_ALLOW_LOCAL_CLERK_AUTH=1 after allowing localhost in Clerk.",
  );

  if (baseURL.includes("localhost") || baseURL.includes("127.0.0.1")) {
    const diagnostics = await page.request.get("/api/auth/clerk/diagnostics");
    if (diagnostics.ok()) {
      const body = await diagnostics.json();
      const blockedByLocalClerk =
        body?.clientErrorCode === "origin_invalid"
        || Boolean(body?.clientNetworkError)
        || body?.frontendApiHost == null;
      setup.skip(
        blockedByLocalClerk,
        "Local Clerk auth is not configured for localhost. Use the live auth config or allow localhost in Clerk.",
      );
    }
  }

  await ensureClerkE2EUser();
  await ensureClerkAuthStateDir();
  await clerkSetup({ dotenv: false });

  await page.goto("/sign-in?redirect_url=/dashboard/");
  await clerk.loaded({ page });
  await clerk.signIn({
    page,
    emailAddress: clerkE2EEmail(),
  });
  await page.goto("/dashboard/?welcome=1");
  await expect(page.locator("[data-dashboard-home-content='1']")).toBeVisible();

  await page.context().storageState({ path: clerkAuthStatePath });
});
