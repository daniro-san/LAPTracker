// The raid opponent's rules (issue 861, D165): a read whose tick meets an event's window moves past it that
// week; a time that meets a Raid Shield read, or has no tick clear of an event, is refused; a missing or
// stale read gives no Start→End; Start→End counts the members in both reads.
import { describe, expect, it } from "vitest";

import { TEST_ENV } from "./app-context.test-helpers";
import {
  DEFAULT_RAID_TIMES,
  raidReadsAt,
  raidSide,
  raidTimeChoices,
  raidTimesRefusal,
  type RaidReadFacts,
} from "./raid-opponent";
import { DEFAULT_TIMES } from "./shield-check";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-11-28T12:00:00Z"); // Sat 10:00 ST: the next four weeks hold Origin of Chaos on 12-05

/** A stored read with members [uid, might, kills]. */
const read = (
  phase: "start" | "end",
  side: "us" | "them",
  members: [number, number | null, number | null][],
  extra: Partial<RaidReadFacts> = {},
): RaidReadFacts => ({
  phase,
  side,
  unionId: side === "us" ? 1 : 2,
  error: null,
  isFresh: true,
  memberCount: members.length,
  memberUids: members.map((m) => m[0]),
  memberPower: members.map((m) => m[1]),
  memberKills: members.map((m) => m[2]),
  readAt: at(phase === "start" ? "2026-12-12T02:01:00Z" : "2026-12-13T02:01:00Z"),
  ...extra,
});

describe("the raid opponent's rules (issue 861)", () => {
  it("moves a read whose tick meets an event's window to the first tick after it that week (Origin of Chaos: 01:30 ST)", () => {
    // A KvK week: both reads right after the reset.
    expect(raidReadsAt("2026-12-12", TEST_ENV, DEFAULT_RAID_TIMES)).toEqual({
      start: at("2026-12-12T02:00:00Z"), // Sat 00:00 ST
      end: at("2026-12-13T02:00:00Z"), // Sun 00:00 ST
    });
    // Origin of Chaos reads 00:00–00:45 ST, due until 01:30 ST: the Start waits for 01:30 ST.
    expect(raidReadsAt("2026-12-05", TEST_ENV, DEFAULT_RAID_TIMES)).toEqual({
      start: at("2026-12-05T03:30:00Z"),
      end: at("2026-12-06T02:00:00Z"),
    });
  });

  it("refuses a time that meets a Raid Shield read, or that leaves a read no tick clear of an event", () => {
    expect(raidTimesRefusal(DEFAULT_RAID_TIMES, DEFAULT_TIMES, TEST_ENV, NOW)).toBeNull();
    // The after-reset check at 00:15 ST reads until 01:00 ST: a Start at 00:30 ST meets it.
    const earlyReset = { ...DEFAULT_TIMES, reset: 15 };
    expect(raidTimesRefusal({ start: 30, end: 0 }, earlyReset, TEST_ENV, NOW)).toBe(
      "reads_overlap",
    );
    // An event on Sunday read 00:30–01:30 ST is due until 02:15 ST: an End from 00:30 ST has no clear tick.
    const sunday = {
      ...TEST_ENV,
      EVENT_WEEKDAY: 0,
      EVENT_TIME: "01:00",
      SNAPSHOT_BEFORE: "00:30",
      SNAPSHOT_AFTER: "01:30",
    };
    expect(raidTimesRefusal({ start: 0, end: 30 }, DEFAULT_TIMES, sunday, NOW)).toBe(
      "event_window",
    );
    expect(raidTimesRefusal({ start: 0, end: 15 }, DEFAULT_TIMES, sunday, NOW)).toBeNull();
    expect(raidTimeChoices(sunday, NOW).end).toEqual([0, 15]);
  });

  it("gives a side no Start→End when either read is missing, failed or stale", () => {
    const start = read("start", "them", [[7, 100, 10]]);
    const end = read("end", "them", [[7, 150, 30]]);
    expect(raidSide([start], "them", 2)).toMatchObject({ end: null, change: null });
    for (const bad of [{ isFresh: false }, { error: "quota_low" }, { unionId: 99 }]) {
      const side = raidSide([start, { ...end, ...bad }], "them", 2);
      expect(side).toMatchObject({ start: { members: 1 }, end: null, change: null });
    }
    expect(raidSide([start, end], "them", 2).change).toEqual({ might: 50, kills: 20, members: 1 });
  });

  it("counts Start→End over the members in both reads: one who left or joined is out, a fall in kills is none", () => {
    const reads = [
      read("start", "us", [
        [1, 1000, 50],
        [2, 2000, 80], // left before the End
        [3, 500, null],
      ]),
      read("end", "us", [
        [1, 900, 40], // lost might, and kills went down: counted as none
        [3, 700, 20], // no kills at the Start: left out of kills, counted in might
        [4, 3000, 90], // joined after the Start
      ]),
    ];
    expect(raidSide(reads, "us", 1)).toEqual({
      start: { members: 3, at: at("2026-12-12T02:01:00Z").getTime() },
      end: { members: 3, at: at("2026-12-13T02:01:00Z").getTime() },
      change: { might: 100, kills: 0, members: 2 },
    });
  });
});
