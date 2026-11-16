import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { LANGUAGES } from "@/lib/copy";

import { compact, makeClock, parseDateFormat } from "./format";

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

  it("writes the admin stamp in the chosen order, with the year", () => {
    const stamp = (date: Parameters<typeof parseDateFormat>[0]) =>
      makeClock("en", SERVER, { own: false, date: parseDateFormat(date) }).stamp(at);
    expect(stamp("dd/mm")).toBe("Sat, 31/10/2026, 14:01 server time");
    expect(stamp("d-mmm")).toBe("Sat, 31 Oct 2026, 14:01 server time");
    expect(stamp(undefined)).toBe("Sat, 10/31/2026, 14:01 server time");
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

describe("compact", () => {
  it("ends in K, M, B or T and has no other letters, for any number of 1,000 or more in every language", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LANGUAGES, "en-GB", "pt-PT", "es-MX"),
        fc.integer({ min: 1000, max: 999_999_999_999_999 }),
        (locale, n) => {
          const text = compact(n, locale);
          expect(text).toMatch(/[KMBT]$/);
          expect(text.slice(0, -1)).not.toMatch(/\p{L}/u);
        },
      ),
    );
  });

  it("reads 4,29B in pt-BR, 1.00M at 999,950, and K/M/B in ja and zh-CN", () => {
    expect(compact(4_290_000_000, "pt-BR")).toBe("4,29B");
    expect(compact(999_950, "en-GB")).toBe("1.00M");
    expect(compact(60_100_000, "en-GB")).toBe("60.1M");
    expect(compact(150_000_000, "ja")).toBe("150M");
    expect(compact(150_000_000, "zh-CN")).toBe("150M");
    expect(compact(999, "en")).toBe("999");
  });
});
