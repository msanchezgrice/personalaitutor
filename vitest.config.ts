import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    env: {
      PERSISTENCE_MODE: "memory",
    },
  },
});
