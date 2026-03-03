import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typedRoutes: true,
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};

export default config;
