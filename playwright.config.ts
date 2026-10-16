import { defineConfig, devices } from "@playwright/test";

// The one Playwright test (AD-18, Story 5.1): the UJ-1 skim in
// tests/e2e/uj1.spec.ts. It runs against a build already served by
// `next start` (the gate's shared server stage), at BASE_URL or
// http://localhost:3000. scripts/e2e-cap.test.mts fails if a second
// Playwright test appears anywhere in the repository.
export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
  },
});
