import { defineConfig, devices } from "@playwright/test";
const apiPort=Number(process.env.E2E_API_PORT??8794),webPort=Number(process.env.E2E_WEB_PORT??5184);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    actionTimeout: 15_000,
    trace: "retain-on-failure",
  },
  projects: [
    ...["platform", "catan", "draw-guess", "carcassonne"].map((scope) => ({ name: scope, testDir: `./tests/e2e/${scope}`, testMatch: "**/*.spec.ts", use: { ...devices["Desktop Chrome"] } })),
  ],
  webServer: [
    {
      command: "pnpm --filter @catan/server exec tsx src/e2e-server.ts",
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      env: { E2E_API_PORT: String(apiPort) },
      timeout: 30_000,
    },
    {
      command: `pnpm --filter @catan/web exec vite --host 127.0.0.1 --port ${webPort} --strictPort --force`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      env: { E2E_API_PORT: String(apiPort) },
      timeout: 30_000,
    },
  ],
});
