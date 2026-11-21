import { prerender } from "react-dom/static";
import { describe, expect, it, vi } from "vitest";

import { en } from "@/lib/copy";
import type { HistoryRow } from "@/lib/queries";

import { AcrossEvents } from "./AcrossEvents";
import { makeClock } from "./format";

vi.mock("./locale", () => ({ requestCopy: async () => en }));

const at = new Date("2026-11-07T14:00:00Z");
const row: HistoryRow = {
  eventId: 1,
  eventName: "Saturday Event 2026-11-07",
  eventAtUtc: at,
  reference: "after",
  updatedAt: at,
  tag: "OGs",
  name: "OldGrandmas",
  memberCount: 97,
  totalPower: 1000,
  totalKills: 50,
  serverRank: 2,
  ledger: null,
  isFresh: true,
  step: {
    power: null,
    kills: null,
    lv: null,
    changed: { name: false, tag: false, alliance: false, lv: false },
  },
  joined: null,
  left: null,
  previous: null,
  inEvent: null,
};

describe("AcrossEvents", () => {
  it("shows Might, Kills and Members, and no alliance level", async () => {
    const { prelude } = await prerender(
      await AcrossEvents({ unionId: 7, history: [row], clock: makeClock("en", "Etc/GMT+2") }),
    );
    const html = await new Response(prelude).text();
    const head = html.match(/<div class="sticky[^>]*>(.*?)<\/div>/)?.[1] ?? "";
    const heads = [...head.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map(([, h]) => h);
    const l = en.ledger;
    expect(heads).toEqual([l.event, l.might, l.kills, l.members]);
    expect(html).not.toContain(l.level);
  });

  it("gives both times their day when the End falls on the day after the Start (issue 473)", async () => {
    // A manual round: Start Nov 5, 20:01 and End Nov 6, 10:39 server time (UTC−2).
    const [start, end] = [new Date("2026-11-05T22:01:00Z"), new Date("2026-11-06T12:39:00Z")];
    const late: HistoryRow = {
      ...row,
      eventAtUtc: start,
      updatedAt: end,
      inEvent: {
        fromAt: start,
        fromPower: 900,
        fromKills: 40,
        power: 100,
        kills: 10,
        members: 0,
        left: 0,
      },
    };
    const { prelude } = await prerender(
      await AcrossEvents({ unionId: 7, history: [late], clock: makeClock("en", "Etc/GMT+2") }),
    );
    const html = await new Response(prelude).text();
    expect(html).toContain("Nov 6, 10:39 server time");
    expect(html).toContain("since Nov 5, 20:01");
  });
});
