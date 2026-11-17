import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { awayOn, awayUntil } from "./fact-fields";
import {
  callOrder,
  registrationOpen,
  REST,
  tally,
  teamOrder,
  toggled,
  type Mark,
} from "./roll-call-rules";
import { tallyParts } from "./roll-call-words";

const marks = (pairs: [number, Mark | null][]) => new Map(pairs);
/** The server's clock (SERVER_TZ), UTC−2. */
const ZONE = "Etc/GMT+2";

describe("roll call rules (issue 298)", () => {
  it("counts a member with no mark, or a cleared one, only as not set, never as a no (D75)", () => {
    const members = [1, 2, 3, 4, 5, 6].map((uid) => ({ uid, away: uid === 6 }));
    const t = tally(
      members,
      marks([
        [1, "yes"],
        [2, "no"],
        [3, "assumed"],
        [4, null],
        [6, "no"],
      ]),
    );
    expect(t).toEqual({ yes: 1, no: 1, assumed: 1, notSet: 2, away: 1 });
  });

  it("fills the rest per kind, none for plunders, and a second tap of the same button clears", () => {
    expect(REST).toEqual({ shield: "assumed", elixir: "no", raid: "yes", plunder: null });
    expect([toggled(null, "yes"), toggled("yes", "yes"), toggled("assumed", "no")]).toEqual([
      "yes",
      null,
      "no",
    ]);
  });

  it("orders not set first, then marked, by name, and away members last", () => {
    const row = (uid: number, name: string, away = false) => ({ uid, name, away });
    const order = callOrder(
      [row(1, "Bo"), row(2, "Ana"), row(3, "Cy", true), row(4, "Dee")],
      marks([[2, "yes"]]),
      "en",
    );
    expect(order.map((m) => m.name)).toEqual(["Bo", "Dee", "Ana", "Cy"]);
  });

  it("leaves a member out only on the days their away note runs, or while on a break", () => {
    const away = { text: "", from: "2026-11-20", until: "2026-11-22" };
    expect(
      ["2026-11-19", "2026-11-20", "2026-11-22", "2026-11-23"].map((d) => awayUntil(away, d)),
    ).toEqual([null, "2026-11-22", "2026-11-22", null]);
    expect(awayUntil({ text: "", until: "2026-11-22" }, "2026-11-16")).toBe("2026-11-22");
    expect(awayOn({}, "2026-11-16", ZONE)).toBeNull();
  });

  it("never reaches into the past: an old note without a first day, and a break, count from their save", () => {
    // Saved 2026-11-18 at 01:00 UTC: still Nov 17 on the server clock (UTC−2).
    const at = "2026-11-18T01:00:00Z";
    const away = { value: { text: "", until: "2026-11-25" }, source: "officer", version: 1, at };
    const brk = { value: "break", source: "officer", version: 1, at } as const;
    const on = (facts: Parameters<typeof awayOn>[0], day: string) => awayOn(facts, day, ZONE);
    expect([on({ away } as never, "2026-11-16"), on({ away } as never, "2026-11-17")]).toEqual([
      null,
      { until: "2026-11-25" },
    ]);
    expect([on({ status: brk }, "2026-11-16"), on({ status: brk }, "2026-11-17")]).toEqual([
      null,
      { until: null },
    ]);
  });

  it("keeps Elixir Scramble registration open until Wednesday (ST), closed from Thursday", () => {
    // The Scramble is on Friday 2026-11-20; its game week starts Monday 2026-11-16.
    expect(registrationOpen("2026-11-20", "2026-11-18")).toBe(true);
    expect(registrationOpen("2026-11-20", "2026-11-19")).toBe(false);
  });

  it("counts lead with how many are marked; not set and the ✗ count stay apart (D75)", () => {
    const t = WORKSPACE_DICTIONARIES.en;
    const parts = (tl: Parameters<typeof tallyParts>[0]) => tallyParts(tl, "shield", t);
    expect(parts({ yes: 1, no: 2, assumed: 0, notSet: 5, away: 0 })).toEqual([
      "3 of 8 marked",
      "Shield up 1",
      "No shield 2",
      "Not set 5",
    ]);
    expect(parts({ yes: 0, no: 0, assumed: 4, notSet: 0, away: 2 })).toEqual([
      "4 of 4 marked",
      "Shield up 0",
      "No shield 0",
      "No problem seen 4",
      "Not set 0",
      "Away 2",
    ]);
  });

  it("suggests daytime at the window first, then no time zone, then night; then activity", () => {
    const c = (uid: number, theirMinute: number | null, active: number | null) => ({
      uid,
      name: `P${uid}`,
      theirMinute,
      active,
      squad: null,
    });
    const order = teamOrder([c(1, 120, 900), c(2, null, 50), c(3, 600, 10), c(4, 900, 400)], "en");
    expect(order.map((x) => x.uid)).toEqual([4, 3, 2, 1]);
  });
});
