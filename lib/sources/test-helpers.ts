// Test-only helpers: fixture bodies and fetch mocking. No network.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { vi } from "vitest";

export const fixturesDir = join(import.meta.dirname, "../../fixtures");

export const readFixture = (path: string): string => readFileSync(join(fixturesDir, path), "utf8");

/** Every recorded /v1 alliance body: fixtures/v1-<ts>/alliance-<id>.json and fixtures/v1-ids/<id>.json. */
export const v1AllianceFixtures = (): string[] =>
  readdirSync(fixturesDir)
    .filter((dir) => dir.startsWith("v1-"))
    .flatMap((dir) =>
      readdirSync(join(fixturesDir, dir))
        .filter((f) => dir === "v1-ids" || f.startsWith("alliance-"))
        .map((f) => `${dir}/${f}`),
    );

export const respond = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers });

/** Stubs global fetch with the given responses in order; returns the mock to inspect calls. */
export function mockFetch(...responses: Response[]) {
  const mock = vi.fn<typeof fetch>();
  for (const r of responses) mock.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", mock);
  return mock;
}

export function stubSourceEnv() {
  vi.stubEnv("LAP_API_KEY", "lap_test-placeholder");
  vi.stubEnv("LAP_API_BASE_URL", "https://v1.test/v1");
  vi.stubEnv("LAP_SITE_BASE_URL", "https://site.test/api");
}

export const headersOf = (mock: ReturnType<typeof mockFetch>, call: number) =>
  new Headers(mock.mock.calls[call]?.[1]?.headers);
