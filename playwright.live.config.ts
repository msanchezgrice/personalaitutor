import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  use: {
    baseURL: process.env.LIVE_BASE_URL || "https://www.myaiskilltutor.com",
    headless: true,
  },
});
