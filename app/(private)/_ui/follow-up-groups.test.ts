// Follow-up's groups (issue 585, slice 2): a member marked Needs help is in the first group only, with the mark
// and their reasons on one row, never also under "Worth a hello". Slice 3: a line every row of a group holds is
// said once under its title. Invented members.
import { describe, expect, it } from "vitest";

import { isolate } from "@/lib/copy";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import type { FollowUpItem } from "@/lib/private/follow-up";
import { cardFormats } from "@/lib/private/member-card";
import type { MemberRow } from "@/lib/private/members";

import { groupsOf } from "./follow-up-groups";

const t = WORKSPACE_DICTIONARIES.en;
const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-20T12:00:00Z")); // Fri 10:00 ST
const quiet = [{ kind: "idle" as const, days: 3 }];
const member = (uid: number, name: string) =>
  ({ uid, name, rank: "R3", isNew: false, reasons: quiet, facts: {} }) as unknown as MemberRow;
const item = (m: MemberRow, extra: Partial<FollowUpItem>): FollowUpItem => ({
  member: m,
  checkIn: true,
  help: false,
  toAsk: [],
  tip: false,
  language: null,
  mark: null,
  lastWeek: null,
  ...extra,
});

describe("Follow-up's groups (issue 585 slice 2)", () => {
  it("puts a member marked Needs help first, with the mark and their reasons on one row, and not under Worth a hello", () => {
    const mark = { at: new Date("2026-11-13T14:00:00Z"), by: "Ana", note: "Asked for help" };
    const groups = groupsOf(
      [item(member(7, "Wren"), { help: true, mark }), item(member(8, "Corwin"), {})],
      t,
      f,
      "en",
    );
    expect(groups.map((g) => [g.title, g.rows.map((r) => r.name)])).toEqual([
      ["Needs help · 1", ["Wren"]],
      ["Worth a hello · 1", ["Corwin"]],
    ]);
    expect(groups[0]?.hint).toBe(
      "They stay here each week until someone taps their name, then “No longer needs help”.",
    );
    expect(groups[0]?.rows[0]?.lines).toEqual([
      { text: `Since Fri, Nov 13 · added by ${isolate("Ana")}`, quote: false },
      { text: "“Asked for help”", quote: true },
      // A no-break space between the number and its unit (D104).
      { text: "Quiet for 3\u00a0days. Worth a hello." },
    ]);
    expect(groups[1]?.hint).toBeUndefined();
  });

  it("says a line every row of a group holds once under its title, never a mark, and keeps each row's own", () => {
    const all = ["squadMight", "troopTier", "adTech", "timeZone", "languages"] as const;
    const fresh = (uid: number, name: string, toAsk: FollowUpItem["toAsk"]) =>
      item(member(uid, name), { checkIn: false, toAsk });
    const mark = { at: new Date("2026-11-13T14:00:00Z"), by: "Ana", note: null };
    const groups = groupsOf(
      [
        // Two marked the same day by the same officer, both quiet for 3 days.
        item(member(1, "Ash"), { help: true, mark }),
        item(member(2, "Bryn"), { help: true, mark }),
        // Three quiet, two new with all five facts to ask, one new with Troops only.
        item(member(3, "Cass"), {}),
        item(member(4, "Dax"), {}),
        item(member(5, "Eden"), {}),
        fresh(6, "Fenn", [...all]),
        fresh(7, "Gale", [...all]),
        fresh(8, "Hale", ["troopTier"]),
        // The coins tip alone: a group of one keeps its line.
        item(member(9, "Ivo"), { checkIn: false, tip: true }),
      ],
      t,
      f,
      "en",
    );
    const quiet = "Quiet for 3 days. Worth a hello.";
    const since = { text: `Since Fri, Nov 13 · added by ${isolate("Ana")}`, quote: false };
    // Needs help: the reason is said once; the mark line stays on each row, with its note when there is one.
    expect(groups[0]?.shared).toEqual({ head: "Same for all 2:", lines: [quiet] });
    expect(groups[0]?.rows.map((r) => r.own)).toEqual([[since], [since]]);
    // The panel keeps every line.
    expect(groups[0]?.rows[0]?.lines).toEqual([since, { text: quiet }]);
    // Worth a hello: the rows show their name and rank only.
    expect(groups[1]?.shared).toEqual({ head: "Same for all 3:", lines: [quiet] });
    expect(groups[1]?.rows.map((r) => r.own)).toEqual([[], [], []]);
    // New: the facts to ask differ, so each row keeps its own and nothing is said for the group.
    expect(groups[2]?.shared).toBeUndefined();
    expect(groups[2]?.rows.map((r) => r.own.map((l) => l.text))).toEqual([
      ["Still to ask: Main squad might, Troops, AD Tech, Time zone, Languages"],
      ["Still to ask: Main squad might, Troops, AD Tech, Time zone, Languages"],
      ["Still to ask: Troops"],
    ]);
    expect(groups[3]?.shared).toBeUndefined();
    expect(groups[3]?.rows[0]?.own).toEqual([{ text: t["followup.reason.coins"] }]);
  });
});
