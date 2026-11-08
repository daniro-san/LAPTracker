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
});
