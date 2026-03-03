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
};

export default config;
