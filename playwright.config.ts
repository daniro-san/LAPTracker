// The e2e suite (issue 477, D150): a production build (`next build`, then `next start`) on a local Postgres
// reached through the db:local bridge, seeded with invented data by e2e/global-setup.ts. Every flow runs on a
// phone (390 px) and the wide frame (1280 px). E2E_NO_BUILD=1 reuses the last build.
import { defineConfig, devices } from "@playwright/test";

import { APP_PORT, BASE_URL, BRIDGE_PORT, SERVER_ENV } from "./e2e/env";

const CI = Boolean(process.env.CI);
const build = process.env.E2E_NO_BUILD ? "" : "pnpm exec next build && ";
// The preload is for `next start` only: under NODE_OPTIONS, `next build` workers would load it too.
// The public pages' shared reads (D143) are kept in .next/cache between server starts; this run's seed is new.
const clearCache = `node -e "require('fs').rmSync('.next/cache/fetch-cache', { recursive: true, force: true })"`;
const start = `${clearCache} && NODE_OPTIONS='--import ./scripts/db-local-preload.mjs --import ./e2e/no-network.mjs' pnpm exec next start -H 127.0.0.1 -p ${APP_PORT}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  forbidOnly: CI,
  retries: 0,
  // One database for the whole run; the flows that write keep to rows no other flow reads.
  workers: CI ? 2 : 3,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "en-GB",
    timezoneId: "Europe/London",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: "wide",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      // The isolation checks do not depend on the window: once is enough.
      testIgnore: /isolation/,
    },
  ],
  webServer: [
    {
      command: "node scripts/db-local-bridge.mjs",
      port: BRIDGE_PORT,
      env: SERVER_ENV,
    },
    {
      command: `${build}${start}`,
      url: `${BASE_URL}/robots.txt`,
      env: SERVER_ENV,
      timeout: 300_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
