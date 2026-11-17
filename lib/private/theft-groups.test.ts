import { describe, expect, it } from "vitest";

import {
  followUpOf,
  groupThefts,
  type AllianceGroup,
  type AttackerGroup,
  type FollowUpChange,
  type FollowUpState,
  type TheftEntry,
} from "./theft-groups";

// The game week of 2026-11-16 (a Monday) in server time (UTC-2): Monday 02:00 UTC to the next Monday.
const WEEK = { from: new Date("2026-11-16T02:00:00Z"), to: new Date("2026-11-23T02:00:00Z") };

let id = 0;
function entry(key: string, tag: string, at: string | null, victim: number | null): TheftEntry {
  id += 1;
  return {
    id,
    at: at === null ? null : new Date(at),
    attackerKey: key,
    attackerName: key.slice(key.indexOf(":") + 1),
    attackerTag: tag,
    stolen: "quest_rewards",
    victimUid: victim,
    victimName: victim === null ? null : `member${victim}`,
    source: "typed",
    note: null,
  };
}

const change = (state: FollowUpState, at: string): FollowUpChange => ({
  attackerKey: "uid:1",
  state,
  note: null,
  changedAt: new Date(at),
  by: "Ana",
});

describe("the thefts log's groups (issue 321)", () => {
  it("counts this week and in total per attacker and per alliance, busiest first", () => {
    const entries = [
      entry("uid:1", "VNC", "2026-11-17T10:00:00Z", 11),
      entry("uid:1", "VNC", "2026-11-18T10:00:00Z", 11),
      entry("uid:1", "VNC", "2026-11-10T10:00:00Z", 12),
      entry("uid:2", "vnc", "2026-11-12T10:00:00Z", 12),
      entry("name:stene", "1b8R", "2026-11-19T10:00:00Z", null),
      entry("name:stene", "1b8R", null, 11),
    ];
    const groups = groupThefts(entries, [], WEEK);
    expect(groups.map((g) => [g.tag, g.week, g.total])).toEqual([
      ["VNC", 2, 4],
      ["1b8R", 1, 2],
    ]);
    const [vnc, other] = groups as [AllianceGroup, AllianceGroup];
    const [first, second] = vnc.attackers as [AttackerGroup, AttackerGroup];
    expect([first.key, first.week, first.total]).toEqual(["uid:1", 2, 3]);
    expect(first.lastAt).toEqual(new Date("2026-11-18T10:00:00Z"));
    // Per-member counts live only inside the attacker's group; an unknown member is not counted.
    expect(first.victims).toEqual([
      { uid: 11, name: "member11", count: 2 },
      { uid: 12, name: "member12", count: 1 },
    ]);
    expect([second.key, second.week, second.total]).toEqual(["uid:2", 0, 1]);
    const stene = other.attackers[0] as AttackerGroup;
    expect(stene.victims).toEqual([{ uid: 11, name: "member11", count: 1 }]);
    // Newest first; the entry whose time was not read comes last.
    expect(stene.entries.map((e) => e.at)).toEqual([new Date("2026-11-19T10:00:00Z"), null]);
  });
});

describe("an attacker's follow-up (issue 321)", () => {
  const theft = (at: string | null) => [entry("uid:1", "VNC", at, 11)];

  it("is open until set, keeps the newest change, and opens again after a later theft", () => {
    expect(followUpOf([], theft("2026-11-17T10:00:00Z"))).toEqual({
      state: "open",
      last: null,
      reopened: false,
    });
    const talked = [change("talked", "2026-11-17T12:00:00Z")];
    expect(followUpOf(talked, theft("2026-11-17T10:00:00Z")).state).toBe("talked");
    const resolved = [...talked, change("resolved", "2026-11-18T12:00:00Z")];
    expect(followUpOf(resolved, theft("2026-11-17T10:00:00Z"))).toMatchObject({
      state: "resolved",
      last: { state: "resolved", by: "Ana" },
      reopened: false,
    });
    // A theft after "resolved" opens it again; one whose time was not read does not.
    expect(followUpOf(resolved, theft("2026-11-19T09:00:00Z"))).toMatchObject({
      state: "open",
      last: { state: "resolved" },
      reopened: true,
    });
    expect(followUpOf(resolved, theft(null)).state).toBe("resolved");
    // An officer can set it back to open by hand; that is not a reopening.
    const reset = [...resolved, change("open", "2026-11-20T12:00:00Z")];
    expect(followUpOf(reset, theft("2026-11-17T10:00:00Z"))).toMatchObject({
      state: "open",
      reopened: false,
    });
  });
});
