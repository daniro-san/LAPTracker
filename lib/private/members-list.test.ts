import { describe, expect, it } from "vitest";

import type { MemberFacts } from "./fact-fields";
import type { MemberRow } from "./members";
import {
  clockAt,
  facetCounts,
  factsToAsk,
  keepMembers,
  NO_QUERY,
  orderMembers,
  pickQuery,
  whoOf,
  type ListMember,
} from "./members-list";

// SERVER_TZ is UTC−2; Nov 17 2026 is outside daylight saving in Paris (UTC+1) and São Paulo (UTC−3).
const clock = clockAt("2026-11-17", "Etc/GMT+2");

const m = (uid: number, over: Partial<ListMember> = {}): ListMember => ({
  uid,
  name: `P${uid}`,
  rankCode: 103,
  might: 1000 * uid,
  kills: 10 * uid,
  squad: null,
  zone: null,
  languages: [],
  ask: [],
  who: [],
  ...over,
});

const fact = <T>(value: T) => ({ value, source: "officer" as const, version: 1 });

describe("Info to ask", () => {
  it("lists the facts not recorded, a cleared fact and an empty language list included", () => {
    const some: MemberFacts = {
      squadMight: fact(9_900_000),
      adTech: fact(null),
      timeZone: fact("Europe/Paris"),
      languages: fact([]),
    };
    expect(factsToAsk(some)).toEqual(["troopTier", "adTech", "languages"]);
    const all: MemberFacts = {
      ...some,
      adTech: fact(60),
      troopTier: fact(10),
      languages: fact(["fr"]),
    };
    expect(factsToAsk(all)).toEqual([]);
  });
});

describe("Daytime and night for them at hh ST", () => {
  it("reads each member's own clock, and a member with no time zone matches neither", () => {
    const rows = [m(1, { zone: "Europe/Paris" }), m(2, { zone: "America/Sao_Paulo" }), m(3)];
    const kept = (mode: "day" | "night", hour: number) =>
      keepMembers(rows, { ...NO_QUERY, time: { mode, hour } }, clock);
    // 18:00 ST is 21:00 in Paris and 17:00 in São Paulo; 23:00 ST is 02:00 and 22:00.
    expect(kept("day", 18).kept.map((r) => r.uid)).toEqual([1, 2]);
    expect(kept("day", 23).kept.map((r) => r.uid)).toEqual([2]);
    expect(kept("night", 23).kept.map((r) => r.uid)).toEqual([1]);
    expect(kept("night", 23).noZone).toBe(1);
    expect(clock("Asia/Kolkata", 0)).toBe(7 * 60 + 30);
  });
});

describe("filters together", () => {
  it("combine with each other and the search, and each count is the list that option would give", () => {
    const rows = [
      m(1, { name: "Laëtitia", rankCode: 104, ask: ["timeZone"], languages: ["fr"] }),
      m(2, { name: "Lars", rankCode: 105, languages: ["fr", "en"] }),
      m(3, { name: "Lark", ask: ["languages"], who: ["new"] }),
      m(4, { name: "Bo", rankCode: 104, ask: ["adTech"] }),
    ];
    const query = { ...NO_QUERY, q: "la", r4: true };
    expect(keepMembers(rows, query, clock).kept.map((r) => r.uid)).toEqual([1, 2]);
    expect(keepMembers(rows, { ...query, ask: true }, clock).kept.map((r) => r.uid)).toEqual([1]);
    const counts = facetCounts(rows, query, clock, ["fr", "en"]);
    expect([counts.r4, counts.ask, counts.who.new, counts.who.any]).toEqual([2, 1, 0, 2]);
    expect(counts.lang).toEqual({ fr: 2, en: 1 });
    const other = facetCounts(rows, { ...query, r4: false }, clock, ["fr", "en"]);
    expect([other.r4, other.who.new, other.ask]).toEqual([2, 1, 2]);
    for (const code of ["fr", "en"]) {
      const chosen = keepMembers(rows, { ...query, lang: code }, clock).kept.length;
      expect(counts.lang[code]).toBe(chosen);
    }
  });
});

describe("orders", () => {
  const rows = [
    m(1, { might: 50, kills: null, squad: 9 }),
    m(2, { might: null, kills: 7, squad: null }),
    m(3, { might: 80, kills: 3, squad: 12, who: ["break"] }),
    m(4, { might: 20, kills: 9, squad: 4 }),
  ];
  const uids = (o: Parameters<typeof orderMembers>[1]) => {
    const r = orderMembers(rows, o);
    return [r.ranked, r.noValue, r.onBreak].map((g) => g.map((x) => x.uid));
  };

  it("sort known values both ways, then put '—' and members on a break in their own groups", () => {
    expect(uids("might")).toEqual([[1, 4], [2], [3]]);
    expect(uids("might-asc")).toEqual([[4, 1], [2], [3]]);
    expect(uids("kills")).toEqual([[4, 2], [1], [3]]);
    expect(uids("kills-asc")).toEqual([[2, 4], [1], [3]]);
    expect(uids("squad")).toEqual([[1, 4], [2], [3]]);
  });

  it("rank then might keeps the break group at the end too", () => {
    const ranked = [m(5, { rankCode: 105, might: 1 }), ...rows];
    const r = orderMembers(ranked, "rank");
    expect([r.ranked.map((x) => x.uid), r.onBreak.map((x) => x.uid)]).toEqual([[5, 1, 4, 2], [3]]);
  });
});

describe("Who", () => {
  const row = (over: Partial<MemberRow>) =>
    ({ reasons: [], officerStatus: null, awayUntil: null, isNew: false, ...over }) as MemberRow;
  it("leaves Check in when an officer set a status, and an away note running is a break", () => {
    const idle = { kind: "might" as const, days: 16 };
    expect(whoOf(row({ reasons: [idle] }))).toEqual(["checkin"]);
    expect(whoOf(row({ reasons: [idle], officerStatus: "help" }))).toEqual(["help"]);
    expect(whoOf(row({ awayUntil: "2026-11-20", isNew: true }))).toEqual(["break", "new"]);
  });
});

describe("pickQuery", () => {
  const pick = (s: string) => pickQuery(new URLSearchParams(s), ["en", "pt"]);
  it("reads the address, drops what it does not know and maps the old ?f= links", () => {
    expect(pick("who=sleepy&day=24&lang=xx&ask=yes")).toEqual(NO_QUERY);
    expect(pick("f=checkin").who).toBe("checkin");
    expect(pick("f=missing")).toEqual(NO_QUERY);
    expect(pick("r4=1&night=3&lang=pt&q=mar")).toEqual({
      ...NO_QUERY,
      q: "mar",
      r4: true,
      time: { mode: "night", hour: 3 },
      lang: "pt",
    });
  });
});
