// The KvK opponent's four workers (D152): the run waits for every worker, one worker's failure or a 429 stops
// the others before their next call, and a claim another run holds is never called. Each test orders the
// claims and the answers by hand, so it fails when its rule breaks. Invented alliances of server 326.
import { describe, expect, it } from "vitest";

import { runSnapshot } from "./collector";
import { NOT_SENT } from "./collector-opponent";
import { enemy, setup, startRow } from "./collector-opponent.test-helpers";
import { EVENT_ID, IDS } from "./collector.test-helpers";
import type { OpponentRead } from "./repo";
import { QuotaExhaustedError } from "./sources/types";

/** A promise the test resolves by hand. */
function gate() {
  let open = () => {};
  const shut = new Promise<void>((resolve) => (open = resolve));
  return { shut, open };
}

/** Enough turns of the microtask queue for a run that is not waiting on anything to finish. */
async function settle() {
  for (let i = 0; i < 500; i++) await Promise.resolve();
}

const errors = (rows: OpponentRead[]) => Object.fromEntries(rows.map((r) => [r.tag, r.error]));

describe("the KvK opponent's workers (D152)", () => {
  it("does not finish the run while a worker's call is still out, after another worker failed", async () => {
    const answer = gate();
    const { deps, repo, tagCalls, rows } = setup(["T1", "T2"], async (tag) => {
      await answer.shut;
      return enemy(tag);
    });
    const claim = repo.insertOpponentRead;
    repo.insertOpponentRead = (row) =>
      row.tag === "T2" ? Promise.reject(new Error("insert failed")) : claim(row);
    let finished = false;
    const run = runSnapshot(EVENT_ID, "before", deps).then(() => (finished = true));

    await settle();
    // T1's call is out; with the workers awaited all together the run would have closed already.
    expect(tagCalls).toEqual(["T1"]);
    expect(finished).toBe(false);
    answer.open();
    await run;
    expect(errors(rows("before"))).toEqual({ T1: null });
  });

  it("stops the other workers before their next call when one worker fails", async () => {
    const t1Sent = gate();
    const { deps, repo, tagCalls, rows } = setup(["T1", "T2", "T3", "T4", "T5", "T6"], (tag) => {
      if (tag === "T1") t1Sent.open();
      return enemy(tag);
    });
    // T2's claim fails once T1's call is out; T3's and T4's land well after that failure reached its worker.
    const claim = repo.insertOpponentRead;
    repo.insertOpponentRead = async (row) => {
      if (row.tag === "T2") {
        await t1Sent.shut;
        throw new Error("insert failed");
      }
      if (row.tag !== "T1") await settle();
      return claim(row);
    };

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    // T1 was sent before T2 failed; T3 and T4 had claimed and are not sent; T5 and T6 are never claimed.
    expect(tagCalls).toEqual(["T1"]);
    expect(errors(rows("before"))).toEqual({ T1: null, T3: NOT_SENT, T4: NOT_SENT });
    expect(summary.callsUsed).toBe(1 + IDS.length + 1);
  });

  it("stops the other workers on a 429 before its log line is written", async () => {
    const failed = gate();
    const { deps, repo, tagCalls, rows } = setup(["T1", "T2", "T3", "T4"], (tag) => {
      if (tag !== "T1") return enemy(tag);
      failed.open();
      return new QuotaExhaustedError("429");
    });
    // The other claims land after T1's 429, while its log line is still being written.
    const claim = repo.insertOpponentRead;
    repo.insertOpponentRead = async (row) => {
      if (row.tag !== "T1") await failed.shut;
      return claim(row);
    };
    const quiet = deps.logger.warn;
    deps.logger.warn = async (code, data) => {
      if (code === "v1.fetch") await settle();
      return quiet(code, data);
    };

    await runSnapshot(EVENT_ID, "before", deps);

    expect(tagCalls).toEqual(["T1"]);
    expect(errors(rows("before"))).toMatchObject({ T2: NOT_SENT, T3: NOT_SENT, T4: NOT_SENT });
    expect(errors(rows("before")).T1).toMatch(/429/);
  });

  it("sends nothing for a tag whose claim another run holds, and gives its count back", async () => {
    const { deps, repo, tagCalls, rows } = setup(["T1", "T2", "T3"], (tag) => enemy(tag));
    // Another run claims T2 between this run's list of what is due and its own claim.
    const claim = repo.insertOpponentRead;
    repo.insertOpponentRead = async (row) => {
      if (row.tag === "T2") await claim({ ...startRow("T2"), snapshotId: 77 });
      return claim(row);
    };

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    expect(tagCalls).toEqual(["T1", "T3"]);
    expect(rows("before").find((r) => r.tag === "T2")?.snapshotId).toBe(77);
    expect(summary.callsUsed).toBe(1 + IDS.length + 2);
  });
});
