import { describe, expect, it } from "vitest";

import { makeClock, parseDateFormat } from "./format";

// Saturday 14:01 server time (UTC−2): 19:01 in Moscow, 09:01 in Los Angeles.
const at = new Date("2026-10-31T16:01:00Z");
const SERVER = "Etc/GMT+2";

describe("makeClock", () => {
  it("keeps today's output when the viewer chose nothing", () => {
    const c = makeClock("en", SERVER);
    expect([c.day(at), c.weekday(at), c.long(at), c.time(at), c.at(at), c.zone]).toEqual([
      "Oct 31",
      "Sat, Oct 31",
      "Saturday, October 31",
      "14:01 server time",
      "Oct 31, 14:01 server time",
      "Server time",
    ]);
  });

  it("shows the viewer's own zone followed by the words your time", () => {
    const moscow = makeClock("en", "Europe/Moscow", { own: true, date: null });
    expect([moscow.at(at), moscow.zone]).toEqual(["Oct 31, 19:01 your time", "Your time"]);
    expect(makeClock("en", "America/Los_Angeles", { own: true, date: null }).time(at)).toBe(
      "09:01 your time",
    );
  });

  it("orders day and month per format, with the locale's own month names", () => {
    const day = (locale: string, date: Parameters<typeof parseDateFormat>[0]) =>
      makeClock(locale, SERVER, { own: false, date: parseDateFormat(date) }).day(at);
    expect(day("en", "d-mmm")).toBe("31 Oct");
    expect(day("en", "mmm-d")).toBe("Oct 31");
    expect(day("en", "dd/mm")).toBe("31/10");
    expect(day("en", "dd.mm")).toBe("31.10");
    expect(day("en", "iso")).toBe("2026-10-31");
    expect(day("pt-BR", "mmm-d")).toBe("out. 31");
  });

  it("puts the weekday before the chosen day in weekday, long and at", () => {
    const c = makeClock("en", SERVER, { own: false, date: "dd.mm" });
    expect([c.weekday(at), c.long(at), c.at(at)]).toEqual([
      "Sat, 31.10",
      "Saturday, 31.10",
      "31.10, 14:01 server time",
    ]);
    expect(makeClock("en", SERVER, { own: false, date: "d-mmm" }).long(at)).toBe(
      "Saturday, 31 October",
    );
  });
});

describe("parseDateFormat", () => {
  it("accepts only the listed format ids", () => {
    expect(parseDateFormat("iso")).toBe("iso");
    expect(parseDateFormat(undefined)).toBeNull();
    expect(parseDateFormat("yyyy")).toBeNull();
    expect(parseDateFormat("toString")).toBeNull();
  });
});
