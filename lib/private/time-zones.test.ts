import { describe, expect, it } from "vitest";

import { offsetFromLocalTime, searchZones, zonesAtLocalTime, zonesNamed } from "./time-zones";

const NOW = new Date("2026-11-16T12:00:00Z");
const O = { now: NOW, serverZone: "Etc/GMT+2" };
const first = (query: string, used?: string[]) =>
  searchZones(query, { ...O, ...(used && { used }) })[0]?.id;

describe("the time-zone picker (#297)", () => {
  it("lists every zone Intl knows, under its IANA name and with its country", () => {
    const all = searchZones("", O);
    expect(all.length).toBe(Intl.supportedValuesOf("timeZone").length);
    expect(all.every((z) => z.country !== null)).toBe(true);
    expect(all.map((z) => z.id)).toEqual(expect.arrayContaining(["Europe/Kyiv", "Asia/Kolkata"]));
    expect(all.map((z) => z.id)).not.toContain("Europe/Kiev");
  });

  it("finds a zone by country in en, pt-BR and fr, by city, by abbreviation and by offset", () => {
    expect(first("ukraine")).toBe("Europe/Kyiv");
    expect(first("Ucrânia")).toBe("Europe/Kyiv");
    expect(first("royaume-uni")).toBe("Europe/London");
    expect(first("uk")).toBe("Europe/London");
    expect(first("Brazil -3")).toBe("America/Sao_Paulo");
    expect(first("PST")).toBe("America/Los_Angeles");
    expect(first("lond")).toBe("Europe/London");
    // Server time is UTC−2, so ST +3 is UTC+1: the fixed zone first, then the cities.
    const st = searchZones("ST +3", O);
    expect(st[0]?.id).toBe("Etc/GMT-1");
    expect(st.map((z) => z.id)).toContain("Europe/Paris");
  });

  it("lists the zones the alliance already uses first", () => {
    expect(first("", ["Asia/Manila"])).toBe("Asia/Manila");
    expect(first("eu +1", ["Europe/Rome"])).toBe("Europe/Rome");
  });

  it("finds the zones whose clock reads their time now", () => {
    expect(offsetFromLocalTime("14:05", NOW)).toBe(120);
    expect(offsetFromLocalTime("01:00", NOW)).toBe(-660);
    expect(zonesAtLocalTime("09:00", O).map((z) => z.id)).toContain("America/Sao_Paulo");
  });

  it("reads the time zones the sheets wrote", () => {
    const named = (text: string) => zonesNamed(text, NOW, "Etc/GMT+2");
    expect(named("US - CST")).toMatchObject({ sure: true, via: "abbreviation" });
    expect(named("US - CST").zones[0]).toBe("America/Chicago");
    expect(named("UK - GMT").zones[0]).toBe("Europe/London");
    expect(named("Belgium")).toMatchObject({ sure: true, zones: ["Europe/Brussels"] });
    expect(named("ST +3")).toMatchObject({ sure: true, zones: ["Etc/GMT-1"] });
    expect(named("somewhere nice").zones).toEqual([]);
  });
});
