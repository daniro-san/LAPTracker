import { describe, expect, it } from "vitest";

import { changedFrom, closeStep, sheetHistory, type HistoryLike } from "./sheet-close";

/** A history that counts its entries; back() is what the browser does later, so the test calls popped(). */
function fakeHistory() {
  const h = { state: null, entries: 1, backs: 0 };
  const history: HistoryLike = {
    get state() {
      return h.state;
    },
    pushState: () => {
      h.entries += 1;
    },
    back: () => {
      h.entries -= 1;
      h.backs += 1;
    },
  };
  return { h, history };
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

  it("gives each open sheet one history entry, and back closes only the sheet on top", () => {
    const { h, history } = fakeHistory();
    const sheets = sheetHistory(history);
    const closed: string[] = [];
    sheets.open(() => (closed.push("member"), "closed"));
    sheets.open(() => (closed.push("facts"), "closed"));
    expect(h.entries).toBe(3);
    // The browser already went back one entry when popstate fires.
    h.entries -= 1;
    sheets.popped();
    expect(closed).toEqual(["facts"]);
    h.entries -= 1;
    sheets.popped();
    expect(closed).toEqual(["facts", "member"]);
    expect(h.entries).toBe(1);
  });

  it("puts the entry back when the sheet asks first, so a second back still lands on the sheet", () => {
    const { h, history } = fakeHistory();
    const sheets = sheetHistory(history);
    let dirty = true;
    sheets.open(() => (dirty ? "stay" : "closed"));
    h.entries -= 1;
    sheets.popped();
    expect(h.entries).toBe(2);
    dirty = false;
    h.entries -= 1;
    sheets.popped();
    expect(h.entries).toBe(1);
  });

  it("takes the entry off when a sheet closes another way, and does not read that back as the officer's", () => {
    const { h, history } = fakeHistory();
    const sheets = sheetHistory(history);
    const closed: string[] = [];
    sheets.open(() => (closed.push("member"), "closed"));
    const release = sheets.open(() => (closed.push("facts"), "closed"));
    release();
    expect(h.backs).toBe(1);
    sheets.popped(); // the popstate of that back
    expect(closed).toEqual([]);
    release(); // a second release does nothing
    expect(h.backs).toBe(1);
    expect(h.entries).toBe(2);
  });
});
