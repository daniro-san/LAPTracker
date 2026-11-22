// Follow-up's groups (issue 585, slice 2): a member marked Needs help is in the first group only, with the mark
// and their reasons on one row, never also under "Worth a hello". Invented members.
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
      "They stay here each week until someone taps “No longer needs help”.",
    );
    expect(groups[0]?.rows[0]?.lines).toEqual([
      { text: `Since Fri, Nov 13 · added by ${isolate("Ana")}`, quote: false },
      { text: "“Asked for help”", quote: true },
      // A no-break space between the number and its unit (D104).
      { text: "Quiet for 3\u00a0days. Worth a hello." },
    ]);
    expect(groups[1]?.hint).toBeUndefined();
  });
});
