// Invented rows in the shapes of the OGs sheets (issue #297); never the real sheets.
import { describe, expect, it } from "vitest";

import { parseDelimited, readSheet } from "./sheet-parse";

const NOW = new Date("2026-11-16T12:00:00Z");
const sheet = (text: string) => readSheet(text, NOW, "Etc/GMT+2");

describe("reading a sheet (#297)", () => {
  it("splits CSV with quoted cells, and cells copied from a spreadsheet (tabs)", () => {
    expect(parseDelimited('﻿Name,Might\r\n"Zed, the ""Great""","54,327,837"\n')).toEqual([
      ["﻿Name", "Might"],
      ['Zed, the "Great"', "54,327,837"],
      [""],
    ]);
    expect(parseDelimited("Name\tTroops\nZed\tT9")).toEqual([
      ["Name", "Troops"],
      ["Zed", "T9"],
    ]);
  });

  it("reads might in millions and AD % as a fraction, as the tracking sheets write them", () => {
    const read = sheet(
      "#,Name,Troops,First Squad,AD%,KVK\n1.0,R4 Zed++,T9,10.7,0.83,Y\n2.0,⚜️ Ivy ⚜️,,9.9,1,\n3.0,,T8,7.4,0.5,\n",
    );
    expect(read?.columns.map((c) => c.field)).toEqual([
      null,
      "name",
      "troopTier",
      "squadMight",
      "adTech",
      null,
    ]);
    expect(read?.rows).toEqual([
      {
        line: 1,
        name: "R4 Zed++",
        role: null,
        facts: { squadMight: 10_700_000, adTech: 83, troopTier: 9 },
        unread: [],
      },
      {
        line: 2,
        name: "⚜️ Ivy ⚜️",
        role: null,
        facts: { squadMight: 9_900_000, adTech: 100 },
        unread: [],
      },
    ]);
  });

  it("takes the tier and the time zone from a participation week, and leaves the rest", () => {
    const read = sheet(
      'Name,Role,Might day 1,Sanctuary,soldier tier,Timezone\nZed,R3,"54,327,837",25.0,T7,US - CST\nIvy,Expelled,,23.0,,ST +3\nOak,R2,,,T8,somewhere\n',
    );
    expect(read?.rows.map((r) => [r.name, r.role, r.facts, r.unread])).toEqual([
      ["Zed", "R3", { troopTier: 7, timeZone: "America/Chicago" }, []],
      ["Ivy", "Expelled", { timeZone: "Etc/GMT-1" }, []],
      ["Oak", "R2", { troopTier: 8 }, ["somewhere"]],
    ]);
    expect(sheet("Might,AD%\n10,0.5")).toBeNull();
  });
});
