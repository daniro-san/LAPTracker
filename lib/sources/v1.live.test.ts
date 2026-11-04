// Opt-in live smoke test (plan §11.3): LAP_LIVE_TEST=1 pnpm vitest run lib/sources/v1.live.test.ts
// Costs exactly 1 quota call: a second request (a retry after a 502) is refused before it leaves.
// LAP_SMOKE_OUT=<path outside fixtures/> saves the body; copying it into fixtures/ is a separate, deliberate act.
import { writeFileSync } from "node:fs";

import { afterAll, describe, expect, it, vi } from "vitest";

import { fetchAlliance } from "./v1";

const FGH = 67111128;

describe.skipIf(process.env.LAP_LIVE_TEST !== "1")("live /v1 smoke", () => {
  afterAll(() => vi.unstubAllGlobals());

  it("reads one alliance through the real client, spending exactly one call", async () => {
    const realFetch = globalThis.fetch;
    let calls = 0;
    vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => {
      calls++;
      if (calls > 1) throw new Error("smoke test: second upstream call refused (budget is 1)");
      return realFetch(...args);
    });

    const alliance = await fetchAlliance(FGH);
    expect(calls).toBe(1);
    expect(alliance.unionId).toBe(FGH);
    expect(alliance.quota).not.toBeNull();
    const out = process.env.LAP_SMOKE_OUT;
    if (out) writeFileSync(out, JSON.stringify(alliance.raw));
    console.log(
      JSON.stringify({
        quota: alliance.quota,
        tag: alliance.tag,
        name: alliance.name,
        serverRank: alliance.serverRank,
        memberCount: alliance.memberCount,
        cached: alliance.cached,
        sourceUpdatedAt: alliance.sourceUpdatedAt,
      }),
    );
  });
});
