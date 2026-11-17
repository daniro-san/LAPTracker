import { describe, expect, it } from "vitest";

import {
  backdropTap,
  changedFrom,
  closeStep,
  outside,
  sheetHistory,
  type HistoryLike,
} from "./sheet-close";

/**
 * A history with real entries and states. back() and forward() move like the browser and return the
 * state of the entry they land on, which the test hands to popped() as the popstate would.
 */
function fakeHistory() {
  const entries: unknown[] = [{ __NA: true }];
  let at = 0;
  const history: HistoryLike & { forward(): unknown; length: number; index: number } = {
    get state() {
      return entries[at];
    },
    pushState: (data) => {
      entries.splice(at + 1, entries.length, data);
      at += 1;
    },
    back: () => {
      at -= 1;
    },
    forward: () => entries[++at],
    get length() {
      return entries.length;
    },
    get index() {
      return at;
    },
  };
  const back = () => {
    history.back();
    return entries[at];
  };
  return { history, back };
}

describe("closing a sheet (Close, Cancel, Escape, the backdrop, back)", () => {
  it("closes when nothing is unsaved, asks when something is, and stays when the sheet cannot close", () => {
    expect(closeStep(false, true)).toBe("close");
    expect(closeStep(true, true)).toBe("ask");
    expect(closeStep(true, false)).toBe("stay");
  });

  it("finds unsaved changes field by field", () => {
    const start = { day: "2026-11-16", time: "21:00", who: null as { uid: number } | null };
    expect(changedFrom(start, { ...start })).toBe(false);
    expect(changedFrom(start, { ...start, time: "21:30" })).toBe(true);
    expect(changedFrom(start, { ...start, who: { uid: 7 } })).toBe(true);
  });

  it("counts a backdrop tap only when the press began and ended outside the card", () => {
    const card = { left: 0, right: 360, top: 16, bottom: 800 };
    expect(outside(card, 4, 4)).toBe(true);
    expect(outside(card, 100, 300)).toBe(false);
    expect(backdropTap(true, true)).toBe(true);
    // A drag that starts in a field and is let go over the backdrop.
    expect(backdropTap(false, true)).toBe(false);
  });

  it("gives each open sheet one marked entry, keeps the router's state, and back closes only the top", () => {
    const { history, back } = fakeHistory();
    const sheets = sheetHistory(history);
    const closed: string[] = [];
    sheets.open(() => (closed.push("member"), "closed"));
    sheets.open(() => (closed.push("facts"), "closed"));
    expect(history.state).toEqual({ __NA: true, lapSheet: 2 });
    sheets.popped(back());
    expect(closed).toEqual(["facts"]);
    sheets.popped(back());
    expect(closed).toEqual(["facts", "member"]);
    expect(history.index).toBe(0);
  });

  it("closes nothing on a forward step", () => {
    const { history, back } = fakeHistory();
    const sheets = sheetHistory(history);
    const closed: string[] = [];
    sheets.open(() => (closed.push("member"), "closed"));
    sheets.open(() => (closed.push("facts"), "closed"));
    sheets.popped(back());
    expect(closed).toEqual(["facts"]);
    // Forward lands on the facts editor's old entry, while the member sheet is still open: nothing
    // closes, and the step is undone, so the next back closes the member sheet.
    sheets.popped(history.forward());
    expect(closed).toEqual(["facts"]);
    expect(history.index).toBe(1);
    sheets.popped(history.state);
    sheets.popped(back());
    expect(closed).toEqual(["facts", "member"]);
  });

  it("puts the entry back when the sheet asks first, so a second back still lands on the sheet", () => {
    const { history, back } = fakeHistory();
    const sheets = sheetHistory(history);
    let dirty = true;
    sheets.open(() => (dirty ? "stay" : "closed"));
    sheets.popped(back());
    expect(history.index).toBe(1);
    dirty = false;
    sheets.popped(back());
    expect(history.index).toBe(0);
  });

  it("takes the entry off when a sheet closes another way, and that back closes nothing else", () => {
    const { history, back } = fakeHistory();
    const sheets = sheetHistory(history);
    const closed: string[] = [];
    sheets.open(() => (closed.push("member"), "closed"));
    const release = sheets.open(() => (closed.push("facts"), "closed"));
    release();
    expect(history.index).toBe(1);
    sheets.popped(history.state); // the popstate of that back
    expect(closed).toEqual([]);
    release(); // a second release does nothing
    expect(history.index).toBe(1);
    sheets.popped(back());
    expect(closed).toEqual(["member"]);
  });
});
