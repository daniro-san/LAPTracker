import { describe, expect, it } from "vitest";

import { digestDays, todayAndTomorrow, type NextItem } from "./home-digest";

const item = (key: string, iso: string, day: string): NextItem => ({
  key,
  title: key,
  st: "",
  at: Date.parse(iso),
  end: Date.parse(iso),
  day,
  href: "",
});
// Server time is UTC−2; Tokyo is UTC+9. Server Tue Nov 17 21:30 is Wed Nov 18 08:30 in Tokyo.
const NOW = Date.parse("2026-11-17T23:30:00Z");
const ITEMS = [
  item("d", "2026-11-19T22:00:00Z", "2026-11-19"), // server Thu 20:00 · Tokyo Fri 07:00
  item("c", "2026-11-18T16:00:00Z", "2026-11-18"), // server Wed 14:00 · Tokyo Thu 01:00
  item("b", "2026-11-18T14:00:00Z", "2026-11-18"), // server Wed 12:00 · Tokyo Wed 23:00
  item("a", "2026-11-17T22:00:00Z", "2026-11-17"), // server Tue 20:00 · Tokyo Wed 07:00
];
const keys = (days: ReturnType<typeof todayAndTomorrow>) => ({
  today: days.today.map((x) => x.key),
  tomorrow: days.tomorrow.map((x) => x.key),
});

describe("todayAndTomorrow", () => {
  it("takes today and tomorrow on the server's clock before the browser's zone is known", () => {
    expect(keys(todayAndTomorrow(ITEMS, "Etc/GMT+2", NOW))).toEqual({
      today: ["a"],
      tomorrow: ["b", "c"],
    });
  });

  it("takes them on the officer's own clock, each day in time order", () => {
    expect(keys(todayAndTomorrow(ITEMS, "Asia/Tokyo", NOW))).toEqual({
      today: ["a", "b"],
      tomorrow: ["c"],
    });
  });

  it("reads server days that cover every viewer's today and tomorrow", () => {
    expect(digestDays("2026-11-17")).toEqual({ from: "2026-11-16", to: "2026-11-19" });
  });
});
