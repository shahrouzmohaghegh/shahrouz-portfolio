// Vitest runs the application logic tests (AD-18); the repository scripts
// keep node:test (`npm run test:scripts`), so scripts/ is not collected here.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["{lib,content,components,app}/**/*.test.{ts,tsx}"],
  },
});
