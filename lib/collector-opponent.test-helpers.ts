// Test-only fakes for the KvK opponent's reads (D152): an invented server 326, its alliances' answers, and
// deps with an opponent saved on the event.
import { expect } from "vitest";

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
import type { AllianceSnapshotInput, OnAttempt } from "./sources/types";

// T0 is Saturday 2026-11-07 12:00 UTC: 10:00 ST, the Start. The war is at 12:00 ST.
export const WAR = new Date("2026-11-07T14:00:00Z"); // Sat 12:00 ST
export const END_AT = new Date("2026-11-07T16:00:00Z"); // Sat 14:00 ST
export const SERVER = 326;
export const enemyId = (tag: string) =>
  68_000_000 + [...tag].reduce((n, c) => n * 31 + c.charCodeAt(0), 0);
/** An opponent alliance's answer: 3 members, its own server. */
export const enemy = (
  tag: string,
  at = ago(T0, minutes(1)),
  extra: Partial<AllianceSnapshotInput> = {},
) => roster(enemyId(tag), at, { tag, name: `Enemy ${tag}`, sid: SERVER, ...extra });

export type Answer = AllianceSnapshotInput | Error;

/** Deps with an opponent of `tags` on the event, and a by-tag fake. */
export function setup(
  tags: string[],
  byTag: (tag: string) => Answer | Promise<Answer>,
  byId?: (id: number) => Answer,
) {
  const v1 = fakeV1((id) =>
    byId && id >= 68_000_000 ? byId(id) : roster(id, ago(T0, minutes(2))),
  );
  const tagCalls: string[] = [];
  v1.fetchAllianceByTag = async (server: number, tag: string, onAttempt?: OnAttempt) => {
    onAttempt?.(0);
    expect(server).toBe(SERVER);
    tagCalls.push(tag);
    const answer = await byTag(tag);
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
export const startRow = (tag: string, extra: Partial<OpponentRead> = {}): OpponentRead => ({
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
