// The roll call grid (issue 412, D103 amended): "To mark" lists the not set and folds the marked under
// "Marked", a mark never moves a tile until a chip is tapped, a search looks through everyone, and Raid
// prep's two marks count as marked only when both are set (D137). Not set is never ✗ (D75).
import { describe, expect, it } from "vitest";

import { gridCounts, matches, sections, takeSnap, type Parts } from "./roll-call-grid";

const rows = [1, 2, 3, 4].map((uid) => ({ uid, name: `Wren ${uid}` }));
const uids = rows.map((r) => r.uid);

describe("the roll call grid", () => {
  it("lists the not set under To mark, folds the marked, and keeps both while marking", () => {
    const marks: Record<number, Parts> = { 1: [null], 2: ["yes"], 3: [null], 4: ["no"] };
    const partsOf = (uid: number) => marks[uid] ?? [null];
    const snap = takeSnap("todo", uids, partsOf);
    marks[1] = ["yes"];
    const s = sections(rows, snap, partsOf, null);
    expect(s.list.map((r) => r.uid)).toEqual([1, 3]);
    expect(s.marked.map((r) => r.uid)).toEqual([2, 4]);
    expect(gridCounts(uids, partsOf)).toEqual({ todo: 1, yes: 2, no: 1, all: 4 });
    const again = sections(rows, takeSnap("todo", uids, partsOf), partsOf, null);
    expect(again.list.map((r) => r.uid)).toEqual([3]);
  });

  it("searches every member, whatever is folded", () => {
    const partsOf = (uid: number): Parts => [uid === 2 ? "yes" : null];
    const s = sections(rows, takeSnap("todo", uids, partsOf), partsOf, (r) => r.name.endsWith("2"));
    expect(s).toEqual({ list: [rows[1]], marked: [] });
  });

  it("reads Raid prep's two marks: to mark while either is not set, ✓ only when both are done", () => {
    expect(matches("todo", ["yes", null])).toBe(true);
    expect(matches("yes", ["assumed", "yes"])).toBe(true);
    expect(matches("yes", ["yes", null])).toBe(false);
    expect(matches("no", [null, "no"])).toBe(true);
    expect(matches("no", [null, null])).toBe(false);
  });
});
