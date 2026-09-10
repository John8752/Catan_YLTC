import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5184",
    actionTimeout: 15_000,
    trace: "retain-on-failure",
  },
  projects: [
    ...["platform", "catan", "draw-guess"].map((scope) => ({ name: scope, testMatch: `**/${scope}/**/*.spec.ts`, use: { ...devices["Desktop Chrome"] } })),
  ],
  webServer: [
    {
      command: "pnpm --filter @catan/server exec tsx src/e2e-server.ts",
      url: "http://127.0.0.1:8794/health",
      reuseExistingServer: false,
      env: { E2E_API_PORT: "8794" },
      timeout: 30_000,
    },
    {
      command: "pnpm --filter @catan/web exec vite --host 127.0.0.1 --port 5184 --strictPort --force",
      url: "http://127.0.0.1:5184",
      reuseExistingServer: false,
      env: { E2E_API_PORT: "8794" },
      timeout: 30_000,
    },
  ],
});
