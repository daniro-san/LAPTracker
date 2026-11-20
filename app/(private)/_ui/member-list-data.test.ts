import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { cardFormats } from "@/lib/private/member-card";
import type { ListSource } from "@/lib/private/members";

import { listRow } from "./member-list-data";

const t = WORKSPACE_DICTIONARIES.en;
const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-17T12:00:00Z"));
const fact = <T>(value: T) => ({ value, source: "officer" as const, version: 1 });

// Invented member; every field the row reads.
const member = (over: Partial<ListSource> = {}): ListSource => ({
  uid: 7,
  name: "Thimble",
  rank: "R4 · Muse",
  rankCode: 104,
  might: 61_234_567,
  kills: null,
  sanctuary: 29,
  activity: 214,
  noQuestsOn: null,
  noDonationsOn: null,
  honor: 300,
  donations: [5150, "later", "later", "later", "later", "later", "later"],
  weekTotal: 5150,
  joinedAt: null,
  lastOnlineAt: null,
  mapX: 1,
  mapY: 2,
  duel: {},
  seenSince: "2026-11-02",
  isNew: false,
  reasons: [],
  missing: [],
  missingDays: 0,
  facts: {},
  officerStatus: null,
  awayUntil: null,
  early: false,
  photo: { hasAvatar: false, frameId: null },
  pastNames: [],
  ...over,
});

describe("a list row", () => {
  it("shows R1–R5 as the code, else the game's label, and '—' with neither", () => {
    const short = (rankCode: number | null, rank: string | null) =>
      listRow(member({ rankCode, rank }), t, f).rankShort;
    expect([short(105, "R5"), short(104, "R4 · Muse"), short(101, "R1")]).toEqual([
      "R5",
      "R4",
      "R1",
    ]);
    expect([short(106, "Guest"), short(null, null)]).toEqual(["Guest", "—"]);
  });

  it("writes main squad and troops, either side '—' when unknown, and kills null as '—'", () => {
    const squad = (facts: ListSource["facts"]) => listRow(member({ facts }), t, f).text.squad;
    expect(squad({ squadMight: fact(48_200_000), troopTier: fact(10) })).toBe("48.2M · T10");
    expect(squad({ troopTier: fact(10) })).toBe("— · T10");
    expect(squad({ squadMight: fact(48_200_000) })).toBe("48.2M");
    expect(squad({})).toBe("—");
    expect(listRow(member(), t, f).text.kills).toBe("—");
  });

  it("has no status line while the member is fine, and one with the evidence for Check in", () => {
    expect(listRow(member(), t, f).statusLine).toBe("");
    const checkin = listRow(member({ reasons: [{ kind: "might", days: 9 }] }), t, f);
    expect(checkin.statusLine).toBe("Check in · might unchanged for 9 days");
  });

  it("says a day with no daily quests as a fact of that day, not as missing data (D127)", () => {
    const row = listRow(member({ activity: null, noQuestsOn: "2026-11-16" }), t, f);
    expect([row.status, row.statusLine]).toEqual(["fine", "No daily quests on Mon, Nov 16"]);
  });

  it("says a day with no donations the same way, and both in one line when both (D127)", () => {
    const day = "2026-11-16";
    const line = (over: Partial<ListSource>) => listRow(member(over), t, f).statusLine;
    expect(line({ noDonationsOn: day, donations: ["none"] })).toBe("No donations on Mon, Nov 16");
    expect(line({ noQuestsOn: day, noDonationsOn: day, donations: ["none"] })).toBe(
      "No quests or donations on Mon, Nov 16",
    );
  });
});
