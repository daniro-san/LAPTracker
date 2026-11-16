import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mockFetch, readFixture, respond, stubSourceEnv } from "./test-helpers";
import { fetchAlliance } from "./v1";

const OGS = "v1-20261104T155902Z/alliance-67111155.json";

beforeEach(() => {
  stubSourceEnv();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("uses a call's own timeout and retry count instead of the defaults", async () => {
  const timeout = vi.spyOn(AbortSignal, "timeout");
  const mock = mockFetch(respond("error code: 503", 503), respond(readFixture(OGS)));
  const error = await fetchAlliance(67111155, undefined, undefined, {
    timeoutMs: 12_000,
    maxRetries: 0,
  }).catch((e: unknown) => e);

  expect(error).toMatchObject({ status: 503 });
  expect(mock).toHaveBeenCalledTimes(1);
  expect(timeout).toHaveBeenCalledWith(12_000);
  expect(timeout).not.toHaveBeenCalledWith(30_000);
});
