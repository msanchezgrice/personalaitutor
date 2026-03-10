import { defineConfig } from "@playwright/test";
import { clerkAuthStatePath } from "./tests/e2e/clerk-auth";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:6396",
    headless: true,
  },
  webServer: {
    command: "pnpm --filter @aitutor/web dev",
    url: "http://localhost:6396",
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "setup",
      testMatch: /dashboard-auth\.setup\.ts/,
    },
    {
      name: "authenticated-dashboard",
      testMatch: /dashboard-authenticated\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        storageState: clerkAuthStatePath,
      },
    },
  ],
});
