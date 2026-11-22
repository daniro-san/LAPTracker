// The roll call grid (issue 412, D103 amended): "To mark" lists the not set and folds the marked under
// "Marked", a mark never moves a tile until a chip is tapped, a search looks through everyone, and Raid
// prep's chips count the Shield only, as its "n of m marked" does (D137, issue 585). Not set is never ✗ (D75).
// The page opens on the chip its address names, and a shown set holds exactly its members (drilldown).
import { describe, expect, it } from "vitest";

import type { Mark } from "@/lib/private/roll-call-rules";

import { filterOf, gridCounts, sections, takeSet, takeSnap } from "./roll-call-grid";

const rows = [1, 2, 3, 4].map((uid) => ({ uid, name: `Wren ${uid}` }));
const uids = rows.map((r) => r.uid);

describe("the roll call grid", () => {
  it("lists the not set under To mark, folds the marked, and keeps both while marking", () => {
    const marks: Record<number, Mark | null> = { 1: null, 2: "yes", 3: null, 4: "no" };
    const markOf = (uid: number) => marks[uid] ?? null;
    const snap = takeSnap("todo", uids, markOf);
    marks[1] = "yes";
    const s = sections(rows, snap, markOf, null);
    expect(s.list.map((r) => r.uid)).toEqual([1, 3]);
    expect(s.marked.map((r) => r.uid)).toEqual([2, 4]);
    expect(gridCounts(uids, markOf)).toEqual({ todo: 1, yes: 2, no: 1, all: 4 });
    const again = sections(rows, takeSnap("todo", uids, markOf), markOf, null);
    expect(again.list.map((r) => r.uid)).toEqual([3]);
  });

  it("searches every member, whatever is folded", () => {
    const markOf = (uid: number): Mark | null => (uid === 2 ? "yes" : null);
    const s = sections(rows, takeSnap("todo", uids, markOf), markOf, (r) => r.name.endsWith("2"));
    expect(s).toEqual({ list: [rows[1]], marked: [] });
  });

  it("counts Raid prep by its Shield: 92 of 98 marked is To mark 6, whatever the wall says", () => {
    // 98 members: 70 ✓ Shield up, 2 "no problem seen", 20 ✗, 6 not set; nobody marked the wall.
    const team = Array.from({ length: 98 }, (_, i) => ({ uid: 500 + i, name: `Aster ${i}` }));
    const shield = (uid: number): Mark | null => {
      const i = uid - 500;
      if (i < 70) return "yes";
      if (i < 72) return "assumed";
      return i < 92 ? "no" : null;
    };
    const all = team.map((t) => t.uid);
    expect(gridCounts(all, shield)).toEqual({ todo: 6, yes: 72, no: 20, all: 98 });
    const s = sections(team, takeSnap("todo", all, shield), shield, null);
    expect(s.list).toHaveLength(6);
    expect(s.marked).toHaveLength(92);
  });

  it("opens on the chip the address names, and on To mark for anything else, never on ✗ by default", () => {
    expect(["todo", "yes", "no", "all"].map(filterOf)).toEqual(["todo", "yes", "no", "all"]);
    for (const asked of [undefined, "", "NO", "remind", ["no", "yes"]]) {
      expect(filterOf(asked)).toBe("todo");
    }
  });

  it("shows exactly a set of members, and a mark meanwhile moves none of them (D103)", () => {
    const marks: Record<number, Mark | null> = { 1: "no", 2: null, 3: "yes", 4: null };
    const markOf = (uid: number) => marks[uid] ?? null;
    const snap = takeSet(uids, [1, 4], "The 2 to remind");
    marks[4] = "yes";
    expect(sections(rows, snap, markOf, null)).toEqual({ list: [rows[0], rows[3]], marked: [] });
    // A member new to the read is never in a shown set.
    const more = [...rows, { uid: 5, name: "Wren 5" }];
    expect(sections(more, snap, markOf, null).list.map((r) => r.uid)).toEqual([1, 4]);
  });
});
