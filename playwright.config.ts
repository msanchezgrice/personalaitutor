import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:6396",
    headless: true,
  },
  webServer: {
    command: "PERSISTENCE_MODE=memory pnpm --filter @aitutor/web dev",
    url: "http://127.0.0.1:6396",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
