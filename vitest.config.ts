import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web"),
      "@aitutor/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@aitutor/shared/": `${path.resolve(__dirname, "packages/shared/src")}/`,
      react: path.resolve(__dirname, "apps/web/node_modules/react/index.js"),
      "react-dom": path.resolve(__dirname, "apps/web/node_modules/react-dom/index.js"),
      "react-dom/server": path.resolve(__dirname, "apps/web/node_modules/react-dom/server.node.js"),
      "server-only": path.resolve(__dirname, "tests/support/server-only.ts"),
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
