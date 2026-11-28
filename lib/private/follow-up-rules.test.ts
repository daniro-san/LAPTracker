import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "./dictionary";
import {
  coinsTip,
  historyLine,
  kvkOpen,
  lastWeekLines,
  markLines,
  notedLine,
  weekCountLine,
  weekStart,
} from "./follow-up-rules";

const dayOf = (at: Date) => at.toISOString().slice(0, 10);

describe("the Follow-up rules (issue 340, D104)", () => {
  it("starts the week at Monday 00:00 server time, not UTC", () => {
    // Server time is UTC−2: Mon 16 Nov 01:00Z is Sun 15 Nov 23:00 ST, still the week before.
    const start = weekStart("2026-11-22", "Etc/GMT+2");
    expect(start.toISOString()).toBe("2026-11-16T02:00:00.000Z");
    expect(new Date("2026-11-16T01:00:00Z") < start).toBe(true);
    expect(new Date("2026-11-16T02:00:00Z") >= start).toBe(true);
  });

  it("writes a follow-up as one history line with its note and officer", () => {
    const t = WORKSPACE_DICTIONARIES.en;
    const date = (at: Date) => dayOf(at);
    const day = (iso: string) => iso;
    const at = new Date("2026-11-16T10:00:00Z");
    const talked = { action: "talked", note: "back after exams", until: null, at, by: "Ana" };
    expect(historyLine({ ...talked, action: "talked" }, t, date, day)).toBe(
      "Talked 2026-11-16: back after exams · ⁨Ana⁩",
    );
    const onBreak = {
      ...talked,
      action: "break" as const,
      note: null,
      until: "2026-11-20",
      by: null,
    };
    expect(historyLine(onBreak, t, date, day)).toBe("On a break 2026-11-16 – 2026-11-20");
  });

  it("gives the coins tip on 5 days below 1,000 with data; a day with no read never counts (D140)", () => {
    expect(coinsTip([400, 999, "none", 400, 400, 1000, 1000])).toBe(true);
    expect(coinsTip([400, 400, 400, 400, 1000, 1000, 1000])).toBe(false);
    expect(coinsTip([400, 400, 400, 400, null, null, null])).toBe(false);
  });

  it("gives the coins tip at exactly 5 days below 1,000 when the other 2 days have no read (D140)", () => {
    expect(coinsTip([null, 400, 999, "none", 400, null, 0])).toBe(true);
  });
});

describe("Follow-up's week in words (#585)", () => {
  it("says Follow-up's two numbers in one line for Home and Members, nothing when both are 0", () => {
    const en = WORKSPACE_DICTIONARIES.en;
    const line = (toLook: number, noted: number) => weekCountLine({ toLook, noted }, en, "en");
    expect(line(12, 4)).toBe("Follow-up: 12 to look at · 4 noted this week");
    expect(line(12, 0)).toBe("Follow-up: 12 to look at");
    expect(line(0, 4)).toBe("Follow-up: nobody to look at · 4 noted this week");
    expect(line(0, 0)).toBeNull();
    const fr = WORKSPACE_DICTIONARIES.fr;
    expect(weekCountLine({ toLook: 3, noted: 1 }, fr, "fr")).toBe(
      "À suivre : 3 sur la liste · 1 noté cette semaine",
    );
  });

  it("writes a noted row with the officer and the day first, and a break with its last day away", () => {
    const t = WORKSPACE_DICTIONARIES.en;
    const date = (at: Date) => dayOf(at);
    const day = (iso: string) => iso;
    const at = new Date("2026-11-19T10:00:00Z");
    const row = { action: "talked" as const, note: "Busy at work", until: null, at, by: "Tomas" };
    expect(notedLine(row, t, date, day)).toBe("⁨Tomas⁩ · 2026-11-19: Talked to them");
    expect(notedLine({ ...row, action: "help", by: "Kira" }, t, date, day)).toBe(
      "⁨Kira⁩ · 2026-11-19: They need help",
    );
    expect(notedLine({ ...row, action: "fine" }, t, date, day)).toBe(
      "⁨Tomas⁩ · 2026-11-19: All fine",
    );
    const away = { ...row, action: "break" as const, until: "2026-11-24", by: null };
    expect(notedLine(away, t, date, day)).toBe("2026-11-19: On a break until 2026-11-24");
  });
});

describe("Follow-up's Needs help in words (#585 slice 2)", () => {
  it("says since when and who added the mark, last week's record as context, each officer's note in quotes", () => {
    const date = (at: Date) => dayOf(at);
    const day = (iso: string) => iso;
    const at = new Date("2026-11-13T10:00:00Z");
    const en = WORKSPACE_DICTIONARIES.en;
    const mark = { at, by: "Ana", note: "Lost the main squad" };
    expect(markLines(mark, en, date)).toEqual([
      "Since 2026-11-13 · added by ⁨Ana⁩",
      "“Lost the main squad”",
    ]);
    // Set in Edit info by an officer no longer known: no name, and no note.
    expect(markLines({ at, by: null, note: null }, en, date)).toEqual(["Since 2026-11-13"]);
    const talked = { action: "talked" as const, note: "on holiday", until: null, at, by: "Tomas" };
    expect(lastWeekLines(talked, en, date, day)).toEqual([
      "Recorded last week: ⁨Tomas⁩ · 2026-11-13: Talked to them",
      "“on holiday”",
    ]);
    expect(lastWeekLines({ ...talked, note: null, by: null }, en, date, day)).toEqual([
      "Recorded last week: 2026-11-13: Talked to them",
    ]);
    // French: guillemets with no-break spaces inside, and one before each colon.
    expect(lastWeekLines(talked, WORKSPACE_DICTIONARIES.fr, date, day)).toEqual([
      "Enregistré la semaine dernière : ⁨Tomas⁩ · 2026-11-13 : On a parlé",
      "« on holiday »",
    ]);
  });
});

describe("After KvK, offer help (#585 slice 5)", () => {
  it("keeps a member written about earlier in the KvK's week, before its End read, out of the group until Monday", () => {
    // Server time UTC−2. KvK Sat 21 Nov, End read 14:00 ST; game weeks start Mon 16 and Mon 23 Nov 00:00 ST.
    const afterAt = new Date("2026-11-21T16:00:00Z"); // Sat 14:00 ST
    const [monday, nextMonday] = [
      weekStart("2026-11-22", "Etc/GMT+2"),
      weekStart("2026-11-23", "Etc/GMT+2"),
    ];
    const hit = new Set([101, 102]);
    // 101 talked to on Thu 19 Nov, before the KvK; nobody wrote about 102.
    const rows = [{ uid: 101, action: "talked", at: new Date("2026-11-19T12:00:00Z") }]; // Thu 10:00 ST
    expect([...kvkOpen(hit, rows, monday, afterAt)]).toEqual([102]);
    // The new week: Thursday's talk was before the KvK, so 101 is offered help again.
    expect([...kvkOpen(hit, rows, nextMonday, afterAt)]).toEqual([101, 102]);
  });
});
