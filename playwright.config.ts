// The e2e suite (issue 477, D150): a production build (`next build`, then `next start`) on a local Postgres
// reached through the db:local bridge, seeded with invented data by e2e/global-setup.ts. Every flow runs on a
// phone (360 px) and the wide frame (1280 px); E2E_WEBKIT=1 adds the desk flows on an iPhone's WebKit (the
// daily run), served over HTTPS by e2e/https-server.mjs from the same build, because WebKit on Linux sends the
// session's Secure cookie to https only. E2E_NO_BUILD=1 reuses the last build.
import { rmSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

import {
  APP_PORT,
  BASE_URL,
  BRIDGE_PORT,
  HTTPS_BASE_URL,
  HTTPS_PORT,
  OUTBOUND_LOG,
  SERVER_ENV,
  STUB_PORT,
  STUB_URL,
} from "./e2e/env";

const CI = Boolean(process.env.CI);
const WEBKIT = process.env.E2E_WEBKIT === "1";
const build = process.env.E2E_NO_BUILD === "1" ? "" : "pnpm exec next build && ";
// This run's outbound log starts absent, before any server starts. Workers load this file too; only the
// runner (no TEST_WORKER_INDEX) deletes it.
if (process.env.TEST_WORKER_INDEX === undefined) rmSync(OUTBOUND_LOG, { force: true });
// The preload is for the servers only (`next start`, e2e/https-server.mjs): under NODE_OPTIONS, `next build` workers would load it too.
// The public pages' shared reads (D143) are kept in .next/cache between server starts; this run's seed is new.
const clearCache = `node -e "require('fs').rmSync('.next/cache/fetch-cache', { recursive: true, force: true })"`;
const preload = "--import ./scripts/db-local-preload.mjs --import ./e2e/no-network.mjs";
const start = `${clearCache} && NODE_OPTIONS='${preload}' pnpm exec next start -H 127.0.0.1 -p ${APP_PORT}`;

export default defineConfig({
  testDir: "e2e",
  // Browser specs only: e2e/*.test.ts are Vitest unit tests of the e2e helpers (e.g. the day-change wait).
  testMatch: /\.spec\.ts$/,
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
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 780 }, hasTouch: true },
    },
    {
      name: "wide",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      // The isolation checks do not depend on the window: once is enough.
      testIgnore: /isolation/,
    },
    // WebKit for the desk flows, in the daily run only (D150: about 11% of desk views are iOS).
    ...(WEBKIT
      ? [
          {
            name: "iphone",
            use: {
              ...devices["iPhone 15"],
              viewport: { width: 360, height: 659 },
              baseURL: HTTPS_BASE_URL,
              // The certificate is self-signed, made for the run (e2e/https-server.mjs).
              ignoreHTTPSErrors: true,
            },
            testMatch: /desk\.spec/,
          },
        ]
      : []),
  ],
  webServer: [
    // The tracker, Groq and Discord's webhooks, for the flows that save a key and post a notice.
    {
      command: `node e2e/stub-server.mjs ${STUB_PORT}`,
      url: `${STUB_URL}/__stub/received`,
      env: SERVER_ENV,
    },
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
    // Started after the one above is up, so after the build.
    ...(WEBKIT
      ? [
          {
            command: `node e2e/https-server.mjs ${HTTPS_PORT}`,
            url: `${HTTPS_BASE_URL}/robots.txt`,
            ignoreHTTPSErrors: true,
            env: { ...SERVER_ENV, NODE_ENV: "production", NODE_OPTIONS: preload },
            stdout: "ignore" as const,
            stderr: "pipe" as const,
          },
        ]
      : []),
  ],
});
