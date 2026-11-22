import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mockFetch, respond, stubSourceEnv } from "./test-helpers";
import { fetchAlliance } from "./v1";

beforeEach(() => stubSourceEnv());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("stops at a call's own retry count instead of the default", async () => {
  const mock = mockFetch(respond("error code: 503", 503), respond("error code: 503", 503));
  const error = await fetchAlliance(67111155, undefined, undefined, { maxRetries: 0 }).catch(
    (e: unknown) => e,
  );
  expect(error).toMatchObject({ status: 503 });
  expect(mock).toHaveBeenCalledTimes(1);
});

it("ends a call that never answers at its own timeout, not the 30 s default", async () => {
  // A request that hangs until its signal aborts, as fetch does. The 30 s default would outlast the
  // test's 10 s, so only the call's own 50 ms can end it.
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
        ),
    ),
  );
  const error = await fetchAlliance(67111155, undefined, undefined, {
    timeoutMs: 50,
    maxRetries: 0,
  }).catch((e: unknown) => e);
  expect(error).toMatchObject({ name: "TimeoutError", detail: { timeoutMs: 50 } });
});

it("asks for the tracker's cached copy, with no fresh=1, when a call passes fresh: false (D133)", async () => {
  const mock = mockFetch(respond(readFixture(OGS)));
  await fetchAlliance(67111155, undefined, undefined, { fresh: false });

  expect(mock.mock.calls.map((c) => String(c[0]))).toEqual([
    "https://v1.test/v1/alliances/67111155",
  ]);
});
