// The KvK opponent's Start and End reads (D152): one call per alliance, after our own, never changing our
// snapshot. Invented alliances of an invented server 326; the war is Saturday 12:00 ST (14:00 UTC).
import { describe, expect, it } from "vitest";

import { runSample, runSnapshot } from "./collector";
import {
  ago,
  EVENT_ID,
  fakeInternal,
  fakeV1,
  IDS,
  makeDeps,
  minutes,
  roster,
  T0,
} from "./collector.test-helpers";
import type { OpponentRead } from "./repo";
import {
  type AllianceSnapshotInput,
  NotFoundError,
  type OnAttempt,
  QuotaExhaustedError,
  UpstreamError,
} from "./sources/types";

// T0 is Saturday 2026-11-07 12:00 UTC: 10:00 ST, the Start. The war is at 12:00 ST.
const WAR = new Date("2026-11-07T14:00:00Z"); // Sat 12:00 ST
const END_AT = new Date("2026-11-07T16:00:00Z"); // Sat 14:00 ST
const SERVER = 326;
const enemyId = (tag: string) =>
  68_000_000 + [...tag].reduce((n, c) => n * 31 + c.charCodeAt(0), 0);
/** An opponent alliance's answer: 3 members, its own server. */
const enemy = (tag: string, at = ago(T0, minutes(1)), extra: Partial<AllianceSnapshotInput> = {}) =>
  roster(enemyId(tag), at, { tag, name: `Enemy ${tag}`, sid: SERVER, ...extra });

type Answer = AllianceSnapshotInput | Error;

/** Deps with an opponent of `tags` on the event, and a by-tag fake. */
function setup(tags: string[], byTag: (tag: string) => Answer, byId?: (id: number) => Answer) {
  const v1 = fakeV1((id) =>
    byId && id >= 68_000_000 ? byId(id) : roster(id, ago(T0, minutes(2))),
  );
  const tagCalls: string[] = [];
  v1.fetchAllianceByTag = async (server: number, tag: string, onAttempt?: OnAttempt) => {
    onAttempt?.(0);
    expect(server).toBe(SERVER);
    tagCalls.push(tag);
    const answer = byTag(tag);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  const made = makeDeps(v1, fakeInternal(), IDS);
  made.repo.tables.opponents.set(EVENT_ID, { id: 1, server: SERVER, tags, eventAtUtc: WAR });
  const rows = (phase: "before" | "after") =>
    made.repo.tables.opponentReads.filter((r) => r.phase === phase);
  const enemyCalls = () => v1.calls.filter((id) => id >= 68_000_000);
  return { ...made, v1, tagCalls, rows, enemyCalls };
}

/** A stored Start row, as an earlier Start left it. */
const startRow = (tag: string, extra: Partial<OpponentRead> = {}): OpponentRead => ({
  opponentId: 1,
  snapshotId: 99,
  phase: "before",
  tag,
  unionId: enemyId(tag),
  sid: SERVER,
  name: `Enemy ${tag}`,
  memberCount: 3,
  totalPower: 6_000_000,
  totalKills: 300,
  memberUids: [1, 2, 3].map((i) => enemyId(tag) * 10 + i),
  memberPower: [1_000_000, 2_000_000, 3_000_000],
  memberKills: [100, 200, null],
  sourceUpdatedAt: ago(T0, minutes(1)),
  cached: false,
  isFresh: true,
  error: null,
  readAt: T0,
  ...extra,
});

describe("the KvK opponent's Start (D152)", () => {
  it("reads each saved tag once after our alliances, and a forced re-run calls none of them again", async () => {
    const { deps, tagCalls, rows } = setup(["AAA", "BBB", "CCC"], (tag) => enemy(tag));

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    expect(tagCalls).toEqual(["AAA", "BBB", "CCC"]);
    expect(summary).toMatchObject({ status: "complete", callsUsed: 1 + IDS.length + 3 });
    expect(rows("before").map((r) => [r.tag, r.unionId, r.isFresh, r.error])).toEqual(
      ["AAA", "BBB", "CCC"].map((t) => [t, enemyId(t), true, null]),
    );
    await runSnapshot(EVENT_ID, "before", deps, { force: true });
    expect(tagCalls).toHaveLength(3);
  });

  it("keeps the members as uid, might and kills only: no name and no raw body", async () => {
    const { deps, rows } = setup(["AAA"], (tag) => enemy(tag));
    await runSnapshot(EVENT_ID, "before", deps);
    const [row] = rows("before");
    expect(row?.memberUids).toEqual([1, 2, 3].map((i) => enemyId("AAA") * 10 + i));
    expect(row?.memberKills).toEqual([100, 200, null]);
    expect(Object.keys(row ?? {})).not.toContain("raw");
    expect(JSON.stringify(row)).not.toContain('"m1"');
  });

  it("stores one error row per failed call, with no retry: not found, not unique, a 502, another server, a duplicate", async () => {
    const answers: Record<string, Answer> = {
      GONE: new NotFoundError("404 on /alliances/326/GONE"),
      TWIN: new UpstreamError(409),
      FLAKY: new UpstreamError(502),
      AWAY: enemy("AWAY", undefined, { sid: 327 }),
      AAA: enemy("AAA"),
      // An old tag of AAA: the same alliance must count once.
      AAA2: enemy("AAA"),
    };
    const { deps, tagCalls, rows } = setup(Object.keys(answers), (tag) => answers[tag] as Answer);

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    expect(tagCalls).toHaveLength(6);
    expect(Object.fromEntries(rows("before").map((r) => [r.tag, r.error]))).toEqual({
      GONE: "not found",
      TWIN: "not unique",
      FLAKY: "http 502",
      AWAY: "wrong server",
      AAA: null,
      AAA2: "duplicate",
    });
    expect(summary.status).toBe("complete");
  });

  it("keeps our snapshot complete when the opponent answers 429, and sends no opponent call after it", async () => {
    const tags = ["T1", "T2", "T3", "T4", "T5", "T6"];
    const { deps, tagCalls, rows } = setup(tags, (tag) =>
      tag === "T1" ? new QuotaExhaustedError("429") : enemy(tag),
    );

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    // Four calls were in flight together; none starts after the 429.
    expect(tagCalls).toEqual(["T1", "T2", "T3", "T4"]);
    expect(rows("before")).toHaveLength(4);
    expect(summary).toMatchObject({ status: "complete", error: null });
  });

  it("sends no Start call at or after the war time", async () => {
    const { deps, clock, tagCalls, rows } = setup(["AAA"], (tag) => enemy(tag));
    clock.now = WAR;
    await runSnapshot(EVENT_ID, "before", deps);
    expect(tagCalls).toEqual([]);
    expect(rows("before")).toEqual([]);
  });

  it("reads no opponent when the remaining quota would not hold requiredQuota(n + k)", async () => {
    // Our 20 reads report 55 remaining; 20 + 3 alliances need 2 × (23 + 5) = 56.
    const quota = { limit: 1000, used: 945, remaining: 55 };
    const { deps, v1, tagCalls } = setup(["AAA", "BBB", "CCC"], (tag) => enemy(tag));
    const ours = v1.fetchAlliance;
    v1.fetchAlliance = async (id, onAttempt) => ({ ...(await ours(id, onAttempt)), quota });

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    expect(tagCalls).toEqual([]);
    expect(summary.status).toBe("complete");
  });

  it("reads no more than 15 Start rows for one opponent, whatever the tags were edited to", async () => {
    const earlier = Array.from({ length: 14 }, (_, i) => startRow(`OLD${i}`));
    const { deps, repo, tagCalls } = setup(["NEW1", "NEW2", "NEW3"], (tag) => enemy(tag));
    repo.tables.opponentReads.push(...earlier);
    await runSnapshot(EVENT_ID, "before", deps);
    expect(tagCalls).toEqual(["NEW1"]);
  });
});

describe("the KvK opponent's End (D152)", () => {
  it("reads each usable Start row once by its union id, never a failed, stale, late or removed one", async () => {
    const { deps, repo, clock, enemyCalls, rows } = setup(
      ["OK", "FAILED", "STALE", "LATE"],
      () => new Error("no Start call at the End"),
      (id) => enemy(id === enemyId("OK") ? "OK" : "?", ago(END_AT, minutes(1))),
    );
    repo.tables.opponentReads.push(
      startRow("OK"),
      startRow("FAILED", { unionId: null, error: "not found" }),
      startRow("STALE", { isFresh: false }),
      startRow("LATE", { readAt: WAR }),
      startRow("REMOVED"),
    );
    clock.now = END_AT;
    await runSnapshot(EVENT_ID, "before", deps);
    await runSnapshot(EVENT_ID, "after", deps);
    expect(enemyCalls()).toEqual([enemyId("OK")]);
    expect(rows("after").map((r) => [r.tag, r.error, r.isFresh])).toEqual([["OK", null, true]]);
  });

  it("stores an End answer that shares none of the Start's members as an error row", async () => {
    const { deps, repo, clock, rows } = setup(
      ["OK"],
      () => new Error("no Start call at the End"),
      (id) =>
        enemy("OK", ago(END_AT, minutes(1)), {
          unionId: id,
          members: [{ uid: 9, name: "x", power: 1, kills: 1, lv: 1 }],
        }),
    );
    repo.tables.opponentReads.push(startRow("OK"));
    clock.now = END_AT;
    await runSnapshot(EVENT_ID, "after", deps);
    expect(rows("after")[0]).toMatchObject({ error: "wrong alliance (roster)", memberUids: null });
  });

  it("keeps the opponent's End reads in a sample's quota rule: 161 for 20 alliances and 15 due", async () => {
    const tags = Array.from({ length: 15 }, (_, i) => `E${i}`);
    const { deps, repo, v1 } = setup(tags, () => new Error("no Start call in a sample"));
    repo.tables.opponentReads.push(...tags.map((t) => startRow(t)));
    v1.fetchQuota = async (onAttempt?: OnAttempt) => {
      onAttempt?.(0);
      return { limit: 1000, used: 840, remaining: 160 };
    };
    const slot = new Date("2026-11-07T13:00:00Z"); // Sat 11:00 ST
    const skipped = await runSample(EVENT_ID, slot, deps);
    expect(skipped.error).toBe("quota: remaining 160 < required 161");
    repo.tables.opponentReads.length = 0;
    const read = await runSample(EVENT_ID, new Date("2026-11-07T13:15:00Z"), deps);
    expect(read.error).toBeNull();
  });
});
