import { defineConfig } from "@playwright/test";
import { clerkAuthStatePath } from "./tests/e2e/clerk-auth";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: process.env.LIVE_BASE_URL || "https://www.myaiskilltutor.com",
    headless: true,
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
