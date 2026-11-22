// The KvK opponent's limits (D152): the run's time floor and call cap, one call per row even when a run dies
// between the call and its answer, an End answer of another alliance, and an opponent failure that never
// changes our snapshot or sample. Invented alliances of an invented server 326.
import { describe, expect, it } from "vitest";

import { MAX_UPSTREAM_CALLS, runSample, runSnapshot } from "./collector";
import { SENT } from "./collector-opponent";
import { END_AT, enemy, setup, startRow } from "./collector-opponent.test-helpers";
import { ago, EVENT_ID, minutes } from "./collector.test-helpers";
import type { Logger } from "./logger";
import type { OnAttempt } from "./sources/types";

/** A logger that keeps each line's code, so a test can see `opponent.failed`. */
function codes() {
  const seen: string[] = [];
  const keep = async (code: string) => void seen.push(code);
  const logger: Logger = { info: keep, warn: keep, error: keep };
  return { logger, seen };
}

describe("the KvK opponent's limits (D152)", () => {
  it("sends no opponent call with less than 5 s of the run's 100 s left", async () => {
    const { deps, v1, clock, tagCalls } = setup(["AAA"], (tag) => enemy(tag));
    // Each of our 20 reads takes 4.8 s: 96 s are gone when the opponent's turn comes.
    const ours = v1.fetchAlliance;
    v1.fetchAlliance = async (id, onAttempt) => {
      clock.now = new Date(clock.now.getTime() + 4_800);
      return ours(id, onAttempt);
    };
    const summary = await runSnapshot(EVENT_ID, "before", deps);
    expect(tagCalls).toEqual([]);
    expect(summary.status).toBe("complete");
  });

  it("sends no opponent call past MAX_UPSTREAM_CALLS, even with four workers checking at once", async () => {
    const { deps, v1, tagCalls } = setup(["T1", "T2", "T3", "T4", "T5"], (tag) => enemy(tag));
    // The quota call reports 98 attempts: with our 20 reads the run is at 118 of 120.
    const quota = v1.fetchQuota;
    v1.fetchQuota = async (onAttempt?: OnAttempt) => {
      for (let i = 0; i < 97; i++) onAttempt?.(i);
      return quota(onAttempt);
    };
    const summary = await runSnapshot(EVENT_ID, "before", deps);
    expect(tagCalls).toHaveLength(MAX_UPSTREAM_CALLS - 118);
    expect(summary).toMatchObject({ status: "complete", callsUsed: MAX_UPSTREAM_CALLS });
  });

  it("never sends a tag again when the run died after its call and before its answer was stored", async () => {
    const { deps, repo, tagCalls, rows } = setup(["AAA", "BBB"], (tag) => enemy(tag));
    const { logger, seen } = codes();
    deps.logger = logger;
    // The answer's write fails, as a crash between the call and the store would leave it.
    repo.updateOpponentRead = () => Promise.reject(new Error("connection lost"));

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    expect(summary.status).toBe("complete");
    expect(seen).toContain("opponent.failed");
    // Both calls went out together, and each left its claim with no answer.
    expect(tagCalls).toEqual(["AAA", "BBB"]);
    expect(rows("before").map((r) => [r.tag, r.error])).toEqual([
      ["AAA", SENT],
      ["BBB", SENT],
    ]);
    await runSnapshot(EVENT_ID, "before", deps, { force: true });
    expect(tagCalls).toEqual(["AAA", "BBB"]);
  });

  it("keeps an End answer of another alliance id as an error row, with no data", async () => {
    const { deps, repo, clock, rows } = setup(
      ["OK"],
      () => new Error("no Start call at the End"),
      (id) => enemy("OK", ago(END_AT, minutes(1)), { unionId: id + 1 }),
    );
    repo.tables.opponentReads.push(startRow("OK"));
    clock.now = END_AT;
    await runSnapshot(EVENT_ID, "after", deps);
    expect(rows("after")[0]).toMatchObject({ error: "wrong alliance (id)", totalPower: null });
  });

  it("logs opponent.failed and keeps our Start complete and our sample read when the opponent cannot be read", async () => {
    const { deps, repo } = setup(["AAA"], (tag) => enemy(tag));
    const { logger, seen } = codes();
    deps.logger = logger;
    repo.opponentFor = () => Promise.reject(new Error("kvk query failed"));
    const start = await runSnapshot(EVENT_ID, "before", deps);
    expect(start).toMatchObject({ status: "complete", error: null });
    const sample = await runSample(EVENT_ID, new Date("2026-11-07T13:00:00Z"), deps); // Sat 11:00 ST
    expect(sample.error).toBeNull();
    expect(seen.filter((c) => c === "opponent.failed")).toHaveLength(2);
  });
});
