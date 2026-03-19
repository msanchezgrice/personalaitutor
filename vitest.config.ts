import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web"),
      "@aitutor/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@aitutor/shared/": `${path.resolve(__dirname, "packages/shared/src")}/`,
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    env: {
      PERSISTENCE_MODE: "memory",
    },
  },
});
